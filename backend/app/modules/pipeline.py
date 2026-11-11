"""시스템 처리 순서(개발·시연용) [제안·팀 확인 필요].

API.md '아직 정하지 않은 것': /internal API(031 → 033 → 041, 049~051)를 언제 부를지 정해지지 않아
지금은 부르는 곳이 없다. 앱 전체 흐름을 시연하려고, 환경 변수 AUTO_PIPELINE=1일 때만
제출(API-026)·확인자 승인(API-038) 응답 뒤에 같은 서비스 함수를 이 순서로 부른다.

    제출 → 스냅샷(PREPARED) → L3 서사·L4 코멘트 → 자동 승인 판정
         → 승인이면 지급(REWARDED), 아니면 L1·L2 생성(확인 요청 화면용)
    확인자 승인 → 지급

기본값은 꺼짐이라 기존 테스트·동작은 바뀌지 않는다. 실패하면 그 단계에서 멈추고
제출건은 그 상태에 남는다 (03 3-2 '계산 실패 시 SUBMITTED 유지, 지급 실패 시 APPROVED 유지').
"""

import logging
import os
import uuid

from app.core.db import SessionLocal

log = logging.getLogger(__name__)

AUTO_PIPELINE_ENV = "AUTO_PIPELINE"
# 같은 제출건에는 늘 같은 키 → 다시 불러도 한 번만 계산·지급된다 (US-04)
_KEY_NS = uuid.UUID("6f1b2d0e-8c4a-4b1e-9a77-1c2d3e4f5a6b")
# L4 입력은 관절 각도 요약 통계여야 하지만 앱의 각도 계산이 아직 없어 고정값을 쓴다 [임시]
_DEMO_POSE_SUMMARY = {"kneeAngle": {"avg": 92.0, "min": 78.0, "max": 104.0}}


def enabled() -> bool:
    return os.environ.get(AUTO_PIPELINE_ENV) == "1"


def _key(kind: str, submission_id: uuid.UUID) -> uuid.UUID:
    return uuid.uuid5(_KEY_NS, f"{kind}:{submission_id}")


def _grant(db, submission_id: uuid.UUID) -> None:
    from app.modules.reward import service as reward

    reward.grant(db, submission_id, _key("grant", submission_id))


def after_submit(submission_id: uuid.UUID) -> None:
    from app.modules.llm import service as llm
    from app.modules.llm.client import get_llm_client
    from app.modules.review import service as review
    from app.modules.snapshot import service as snapshot

    with SessionLocal() as db:
        try:
            snapshot.prepare_snapshot(db, submission_id)
        except Exception:
            log.exception("pipeline: snapshot 실패 %s", submission_id)
            return
        client = get_llm_client()
        for step in (
            lambda: llm.generate_narrative(db, client, submission_id),
            lambda: llm.generate_form_tip(db, client, submission_id, _DEMO_POSE_SUMMARY),
        ):
            try:
                step()
            except Exception:  # LLM이 실패해도 진행은 막지 않는다 (US-02)
                log.exception("pipeline: LLM 실패 %s", submission_id)
                db.rollback()
        try:
            result = review.auto_approve(db, submission_id)
        except Exception:
            log.exception("pipeline: 자동 승인 판정 실패 %s", submission_id)
            return
        if result.submission.status == "APPROVED":
            try:
                _grant(db, submission_id)
            except Exception:
                log.exception("pipeline: 지급 실패 %s", submission_id)
            return
        try:
            llm.generate_review_summary(db, client, submission_id)
        except Exception:
            log.exception("pipeline: L1·L2 실패 %s", submission_id)


def after_review_approve(submission_id: uuid.UUID) -> None:
    with SessionLocal() as db:
        try:
            _grant(db, submission_id)
        except Exception:
            log.exception("pipeline: 확인자 승인 뒤 지급 실패 %s", submission_id)
