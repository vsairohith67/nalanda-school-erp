from .base import CandidateAdapter, UnavailableAdapter
from .external import ExternalJsonAdapter
from .paddle import PaddleOCRAdapter
from .surya import SuryaServerAdapter
from .tesseract import TesseractAdapter
from .unlimited import UnlimitedOCRServerAdapter

__all__ = ["CandidateAdapter", "UnavailableAdapter", "ExternalJsonAdapter", "PaddleOCRAdapter", "SuryaServerAdapter", "TesseractAdapter", "UnlimitedOCRServerAdapter"]
