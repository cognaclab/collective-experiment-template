/*
  Auto-generated survey data file.
  Edit with care: keep item wording EXACT if you are modifying an established scale.
*/
window.RIKEN_SURVEY_DATA = window.RIKEN_SURVEY_DATA || {};
window.RIKEN_SURVEY_DATA["demographics"] = {
  "id": "demographics",
  "title": "Demographic Questionnaire",
  "questions": [
    {
      "id": "prolific_id",
      "num": 0,
      "title": "Prolific ID",
      "text": "Please enter your Prolific ID (or the participant ID you were given).",
      "type": "text",
      "required": true,
      "help": "This ID is used to link your Session 1 and Session 2 data across days/sessions. If you were recruited via Prolific, this is the PROLIFIC_PID you see on the Prolific website."
    },
    {
      "id": "demo_q01",
      "num": 1,
      "title": "Age",
      "text": "“What is your age?”",
      "type": "number",
      "required": true,
      "help": "Open numeric entry (years)"
    },
    {
      "id": "demo_q02",
      "num": 2,
      "title": "Gender",
      "text": "“What is your gender?”",
      "type": "radio",
      "required": true,
      "options": [
        {
          "value": "Male",
          "label": "Male"
        },
        {
          "value": "Female",
          "label": "Female"
        },
        {
          "value": "Non-binary / Third gender",
          "label": "Non-binary / Third gender"
        },
        {
          "value": "Prefer to self-describe:",
          "label": "Prefer to self-describe: ______",
          "freeText": true
        },
        {
          "value": "Prefer not to say",
          "label": "Prefer not to say"
        }
      ],
      "help": null
    },
    {
      "id": "demo_q03",
      "num": 3,
      "title": "Nationality",
      "text": "“What is your nationality?”",
      "type": "text",
      "required": true
    },
    {
      "id": "demo_q04",
      "num": 4,
      "title": "Country of Residence",
      "text": "“Which country do you currently live in?”",
      "type": "text",
      "required": true
    },
    {
      "id": "demo_q05",
      "num": 5,
      "title": "Native Language",
      "text": "“What is your first / native language?”",
      "type": "text",
      "required": true
    },
    {
      "id": "demo_q06",
      "num": 6,
      "title": "Additional Languages",
      "text": "“Please list any additional languages you speak fluently.”",
      "type": "textarea",
      "required": true
    },
    {
      "id": "demo_q07",
      "num": 7,
      "title": "Ethnicity / Cultural Background",
      "text": "“How would you describe your ethnic or cultural background?”",
      "type": "textarea",
      "required": true
    },
    {
      "id": "demo_q08",
      "num": 8,
      "title": "Education Level",
      "text": "“What is the highest level of education you have completed?”",
      "type": "radio",
      "required": true,
      "options": [
        {
          "value": "Less than high school",
          "label": "Less than high school"
        },
        {
          "value": "High school diploma",
          "label": "High school diploma"
        },
        {
          "value": "Some university",
          "label": "Some university"
        },
        {
          "value": "Bachelor’s degree",
          "label": "Bachelor’s degree"
        },
        {
          "value": "Master’s degree",
          "label": "Master’s degree"
        },
        {
          "value": "Doctoral degree",
          "label": "Doctoral degree"
        },
        {
          "value": "Professional degree",
          "label": "Professional degree"
        },
        {
          "value": "Other:",
          "label": "Other: ______",
          "freeText": true
        }
      ],
      "help": null
    },
    {
      "id": "demo_q09",
      "num": 9,
      "title": "Field of Study (if applicable)",
      "text": "“If you are a student or degree-holder, what is/was your field of study?”",
      "type": "text",
      "required": false
    },
    {
      "id": "demo_q10",
      "num": 10,
      "title": "Employment Status",
      "text": "“What is your current employment status?”",
      "type": "radio",
      "required": true,
      "options": [
        {
          "value": "Employed full-time",
          "label": "Employed full-time"
        },
        {
          "value": "Employed part-time",
          "label": "Employed part-time"
        },
        {
          "value": "Self-employed",
          "label": "Self-employed"
        },
        {
          "value": "Student",
          "label": "Student"
        },
        {
          "value": "Unemployed",
          "label": "Unemployed"
        },
        {
          "value": "Retired",
          "label": "Retired"
        },
        {
          "value": "Other:",
          "label": "Other: ______",
          "freeText": true
        }
      ],
      "help": null
    },
    {
      "id": "demo_q11",
      "num": 11,
      "title": "Socioeconomic Status (Self-Placement)",
      "text": "“How would you describe your socioeconomic status?”",
      "type": "radio",
      "required": true,
      "options": [
        {
          "value": "Low",
          "label": "Low"
        },
        {
          "value": "Lower-middle",
          "label": "Lower-middle"
        },
        {
          "value": "Middle",
          "label": "Middle"
        },
        {
          "value": "Upper-middle",
          "label": "Upper-middle"
        },
        {
          "value": "High",
          "label": "High"
        }
      ],
      "help": null
    },
    {
      "id": "demo_q12",
      "num": 12,
      "title": "Household Income Range",
      "text": "(Optional depending on country and IRB)",
      "type": "text",
      "required": false,
      "help": "Income brackets appropriate to country of residence"
    },
    {
      "id": "demo_q13",
      "num": 13,
      "title": "Political Orientation",
      "text": "“How would you describe your political orientation?”",
      "type": "radio",
      "required": true,
      "options": [
        {
          "value": 1,
          "label": "Very liberal / left"
        },
        {
          "value": 2,
          "label": "Liberal"
        },
        {
          "value": 3,
          "label": "Slightly liberal"
        },
        {
          "value": 4,
          "label": "Moderate"
        },
        {
          "value": 5,
          "label": "Slightly conservative"
        },
        {
          "value": 6,
          "label": "Conservative"
        },
        {
          "value": 7,
          "label": "Very conservative"
        },
        {
          "value": "Prefer not to say",
          "label": "Prefer not to say"
        }
      ],
      "help": "(This is required for MFQ interpretation and group heterogeneity analyses.)"
    },
    {
      "id": "demo_q14",
      "num": 14,
      "title": "Religious Affiliation",
      "text": "“What is your religious affiliation, if any?”",
      "type": "radio",
      "required": true,
      "options": [
        {
          "value": "None",
          "label": "None"
        },
        {
          "value": "Atheist / Agnostic",
          "label": "Atheist / Agnostic"
        },
        {
          "value": "Christian",
          "label": "Christian"
        },
        {
          "value": "Muslim",
          "label": "Muslim"
        },
        {
          "value": "Hindu",
          "label": "Hindu"
        },
        {
          "value": "Buddhist",
          "label": "Buddhist"
        },
        {
          "value": "Jewish",
          "label": "Jewish"
        },
        {
          "value": "Other:",
          "label": "Other: ______",
          "freeText": true
        }
      ],
      "help": null
    },
    {
      "id": "demo_q15",
      "num": 15,
      "title": "Strength of Religiosity",
      "text": "“How religious would you say you are?”",
      "type": "radio",
      "required": true,
      "options": [
        {
          "value": 1,
          "label": "Not at all"
        },
        {
          "value": 2,
          "label": "2"
        },
        {
          "value": 3,
          "label": "3"
        },
        {
          "value": 4,
          "label": "4"
        },
        {
          "value": 5,
          "label": "5"
        },
        {
          "value": 6,
          "label": "6"
        },
        {
          "value": 7,
          "label": "Very religious"
        }
      ]
    },
    {
      "id": "demo_q16",
      "num": 16,
      "title": "Familiarity With Online Experiments",
      "text": "“Have you previously participated in online economic or psychological experiments?”",
      "type": "radio",
      "required": true,
      "options": [
        {
          "value": "Yes",
          "label": "Yes"
        },
        {
          "value": "No",
          "label": "No"
        }
      ],
      "help": null
    },
    {
      "id": "demo_q17",
      "num": 17,
      "title": "Device Used",
      "text": "“What device are you using right now?”",
      "type": "radio",
      "required": true,
      "options": [
        {
          "value": "Desktop / Laptop",
          "label": "Desktop / Laptop"
        },
        {
          "value": "Tablet",
          "label": "Tablet"
        },
        {
          "value": "Mobile phone",
          "label": "Mobile phone"
        }
      ],
      "help": "(For response-time quality control.)"
    },
    {
      "id": "demo_q18",
      "num": 18,
      "title": "Consent Confirmation",
      "text": "“I confirm that I am at least 18 years old and consent to participate in this study.”",
      "type": "radio",
      "required": true,
      "options": [
        {
          "value": "Yes",
          "label": "Yes"
        },
        {
          "value": "No",
          "label": "No (ends survey)"
        }
      ]
    }
  ]
};
