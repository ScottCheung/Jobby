class DomainError(Exception):
    """Base class for errors that must be translated at an API boundary."""


class CareerProfileNotReady(DomainError):
    pass


class ResumeAssetDataUnavailable(DomainError):
    pass


class ApplicationStatusNotRecordable(DomainError):
    pass


class InsufficientCoins(DomainError):
    pass


class TailoredResumeGenerationInProgress(DomainError):
    pass


class TailoredResumeGenerationUnavailable(DomainError):
    pass


class TailoredResumeGenerationFailed(DomainError):
    pass
