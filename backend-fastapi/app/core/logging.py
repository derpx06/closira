import logging
import structlog


def configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    logging.getLogger('passlib').setLevel(logging.ERROR)
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt='iso'),
            structlog.processors.add_log_level,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        logger_factory=structlog.PrintLoggerFactory(),
    )


logger = structlog.get_logger('assistflow-fastapi')
