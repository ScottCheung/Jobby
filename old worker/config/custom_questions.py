
###################################################### CUSTOM APPLICATION QUESTIONS ######################################################

# Define your own question-answer rules. Checked before cache and keyword rules.
#
# Each rule supports:
#   - keywords: list of phrases; matches if ANY keyword appears in the question label
#   - label: exact match on the full question text (after normalization)
#   - answer: the value to fill or select
#   - field_types: optional list restricting to "text", "textarea", "select", "radio", "checkbox"

custom_questions = [
    {
        "keywords": ["relocate", "willing to relocate"],
        "answer": "Yes",
        "field_types": ["radio", "select"],
    },
    {
        "label": "How did you hear about us?",
        "answer": "LinkedIn",
    },
    {
        "keywords": ["security clearance"],
        "answer": "No",
    },
]
