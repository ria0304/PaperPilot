import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "backend"))

from main import LENGTHS


def build_prompt(question, subject, length, has_image):
    return "\n\n".join([
        "You are writing the answer for a student's handwritten assignment.",
        f"Subject: {subject or 'general'}. Length for each question: {LENGTHS[length]}. Use simple, student-friendly language and short sentences.",
        "The question paper is in the attached image. Answer every question on it, in order." if has_image else f"Question or assignment:\n{question}",
        'If there are several questions, answer each in order and begin each answer with a heading such as "# Q1. Short title".',
        'Output rules, strictly: plain text only. Use "# " for the main heading, "## " for sub-headings, "- " for bullets and "1. " for numbered steps. Put one blank line before each heading. Do not use bold, asterisks, backticks, tables or code fences. Write maths in plain characters (x^2, O(n log n), <=). For a binary search tree example you may add one line like [bst 50 30 70 20 40] listing the keys in insertion order.',
        "Reply with only the answer text.",
    ])


def test_build_prompt_has_correct_length_marker():
    assert "about 120 words" in build_prompt("q", None, "short", False)


def test_build_prompt_has_correct_medium_length_marker():
    assert "about 300 words" in build_prompt("q", None, "medium", False)


def test_build_prompt_has_correct_long_length_marker():
    assert "about 600 words" in build_prompt("q", None, "long", False)


def test_build_prompt_uses_subject():
    result = build_prompt("q", "Data Structures", "medium", False)
    assert "Data Structures" in result


def test_build_prompt_with_image_mentions_paper():
    result = build_prompt("q", None, "medium", True)
    assert "question paper is in the attached image" in result
