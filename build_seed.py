"""Generates seed/sessions.json, seed/activities.json and seed/activities.schema.json
from the HoDs' Learning Circle documents (Rounds 1-4), the Dean's worksheet and the
T-shaped paper. Every activity carries a sourceRef; activities not directly present
in the sources are marked derived=True."""
import json, os

os.makedirs("seed", exist_ok=True)

LC1 = "Hod_Circle_1.docx"
LC2 = "HoD_Circle_2.pdf"
LC3 = "HoDs_Circle_Session3_Updated_14_Aug_2026.pdf"
LC4 = "HoD_circle_-_4_concept_note_and_schedule.pdf"
DW = "Deans_worksheet_copy_sep_25.docx"
TP = "paper_on_T_shaped.pdf"

TIMES = {"I": "09:15-10:45", "II": "11:15-12:45", "III": "13:45-15:00", "IV": "15:15-16:30"}
DATES = {1: "2026-09-28", 2: "2026-09-29", 3: "2026-09-30"}

SESSIONS = [
    (1, "I", "Setting the Vision: Why Future-Ready Graduates Need Depth, Breadth and Rigour", "Dean(s)"),
    (1, "II", "The T-Shaped Graduate: Understanding Vertical Depth, Horizontal Breadth and the 70:30 Principle", "Dean(s)"),
    (1, "III", "Diagnosing Our Department: Applying the Academic Rigour Checklist and Disciplinary Depth Audit", "Head of the Department"),
    (1, "IV", "From Diagnosis to Direction: Dimensions of Academic Quality and Case Studies in Depth vs. Breadth", "Head of the Department"),
    (2, "I", "Locating the Threshold: Identifying Threshold Concepts and Mapping Disciplinary Depth", "Internal Faculty - Nominated"),
    (2, "II", "Higher-Order Thinking in Action: Redesigning a Course Assessment Using the Rigour Model", "Internal Faculty - Nominated"),
    (2, "III", "Measuring Cognitive Depth: Applying Webb's DOK and the Cognitive Rigour Matrix to a Syllabus", "Internal Faculty - Nominated"),
    (2, "IV", "Building Breadth Through Depth: Issue-Based Redesign of the Working Document", "Internal Faculty - Nominated"),
    (3, "I", "Designing the Vertical: Progressive Curriculum Mapping from Year 1 to Year 4", "Internal Faculty - Nominated"),
    (3, "II", "Assessing for Depth: Authentic Tasks, Rubrics and Reducing Rote Learning", "Internal Faculty - Nominated"),
    (3, "III", "From Practice to Scholarship: Introducing SoTL and Documenting Curricular Change", "Internal Faculty - Nominated"),
    (3, "IV", "Consolidating the Department Action Plan: Priorities, Owners and Timelines for a T-Shaped Curriculum", "Internal Faculty - Nominated"),
]
SLOT_N = {"I": 1, "II": 2, "III": 3, "IV": 4}
sessions = []
for i, (day, slot, title, fac) in enumerate(SESSIONS, 1):
    sessions.append({
        "sessionId": f"d{day}s{SLOT_N[slot]}", "day": day, "date": DATES[day], "slot": slot,
        "time": TIMES[slot], "title": title, "facilitator": fac, "order": i,
    })

# ---------------------------------------------------------------- helpers
def items(prefix, texts):
    return [{"id": f"{prefix}{i}", "text": t} for i, t in enumerate(texts, 1)]

def opts(texts):
    return [{"id": f"o{i}", "text": t} for i, t in enumerate(texts, 1)]

def q(qid, prompt, maxChars=1500):
    return {"id": qid, "prompt": prompt, "maxChars": maxChars}

SCALE_1_5_EVIDENT = {"min": 1, "max": 5, "labels": ["Not Evident", "Emerging", "Partially Established", "Well Established", "Fully Embedded"]}
SCALE_1_5_DEV = {"min": 1, "max": 5, "labels": ["Not Evident", "Emerging", "Developing", "Well Established", "Fully Embedded"]}
SCALE_AGREE = {"min": 1, "max": 5, "labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}

activities = []

def add(session, n, slug, title, widget, config, source, instructions="", group=False,
        derived=False, timeLimitMin=None, carry=None, scoring=None):
    a = {
        "activityId": f"{session}_a{n}_{slug}", "sessionId": session, "order": n,
        "title": title, "instructions": instructions, "widgetType": widget,
        "config": config, "sourceRef": source,
        "groupMode": "group" if group else "individual", "derived": derived,
    }
    if timeLimitMin: a["timeLimitMin"] = timeLimitMin
    if carry: a["carryForward"] = carry
    if scoring: a["scoring"] = scoring
    activities.append(a)

# ============================================================ DAY 1
# ---- D1 S-I
add("d1s1", 1, "four_pillars", "The Four Pillars: Where Do We Stand?", "composite", {"parts": [
    {"id": "p1", "widgetType": "poll", "config": {"questions": [
        {"id": "q1", "prompt": "Which of the four pillars is currently the WEAKEST in our department?", "multi": False,
         "options": opts(["T-shaped learning - the destination",
                          "Academic rigour - the depth",
                          "Higher-order thinking - the cognitive engine",
                          "Scholarship of Teaching and Learning (SoTL) - the improvement mechanism"])}]}},
    {"id": "p2", "widgetType": "free_text", "config": {"questions": [
        q("q2", "Why did you choose this pillar? Give one example from your own teaching.")]}},
]}, f"{LC4} - Concept Note, four interconnected ideas",
    instructions="T-shaped learning is the destination. Academic rigour is the depth. Higher-order thinking is the cognitive engine. SoTL is the improvement mechanism.")

TL_SECTIONS = [
    ("A", "Student-Centred Teaching and Learning", [
        "Faculty regularly use active learning strategies in classrooms.",
        "Students are encouraged to participate, discuss, and collaborate during learning activities.",
        "Teaching approaches promote critical thinking and problem-solving.",
        "Experiential learning opportunities are integrated into courses."]),
    ("B", "Curriculum and Learning Design", [
        "The curriculum is regularly updated to reflect current developments in the discipline.",
        "Courses are aligned with clearly defined learning outcomes.",
        "Interdisciplinary and multidisciplinary learning opportunities are available.",
        "Industry and societal needs are reflected in curriculum design."]),
    ("C", "Assessment and Feedback", [
        "Assessments measure higher-order thinking and application of knowledge.",
        "Students receive timely and constructive feedback.",
        "Multiple assessment methods are used to evaluate learning.",
        "Assessment practices support continuous learning and improvement."]),
    ("D", "Technology and AI Integration", [
        "Digital technologies are effectively integrated into teaching and learning.",
        "Faculty use learning management systems and digital resources effectively.",
        "Students are guided on the ethical use of Artificial Intelligence tools.",
        "AI is being explored to enhance teaching, learning, and assessment practices."]),
    ("E", "Student Engagement and Success", [
        "Students actively engage in classroom and co-curricular learning activities.",
        "Mechanisms exist to identify and support struggling students.",
        "Student feedback is regularly collected and acted upon.",
        "The department promotes a culture of belonging and inclusivity."]),
    ("F", "Research and Innovation in Learning", [
        "Research-based learning is integrated into courses.",
        "Students are encouraged to undertake research projects and inquiry-based assignments.",
        "Faculty regularly innovate and experiment with teaching practices.",
        "The department promotes creativity, innovation, and entrepreneurship."]),
    ("G", "Faculty Development and Learning Culture", [
        "Faculty participate regularly in professional development programmes.",
        "Peer learning and sharing of best teaching practices are encouraged.",
        "Teaching excellence is recognized and rewarded.",
        "The department actively supports continuous improvement in teaching quality."]),
    ("H", "Quality Assurance and Continuous Improvement", [
        "Learning outcomes are systematically monitored and evaluated.",
        "Data and evidence are used to improve teaching and learning practices.",
        "The department regularly reviews its teaching-learning processes.",
        "Quality enhancement initiatives are implemented based on identified needs."]),
]
add("d1s1", 2, "tl_questionnaire", "Contemporary Teaching and Learning Assessment Questionnaire", "rating_scale", {
    "scale": SCALE_AGREE,
    "sections": [{"id": s, "title": f"{s}. {t}", "items": items(s.lower(), its)} for s, t, its in TL_SECTIONS],
    "reflections": [
        q("r1", "What are the three strongest aspects of teaching and learning in our department?"),
        q("r2", "What are the three areas that require immediate attention?"),
        q("r3", "What is one innovative teaching-learning initiative you can implement in your own courses in the next academic year?"),
        q("r4", "What should our department be known for in teaching and learning by 2030?"),
        q("r5", "What kind of learning culture exists in our department today?"),
        q("r6", "What are you most proud of in your own teaching and learning practice?"),
    ]},
    f"{LC1} - Contemporary Teaching and Learning Assessment Questionnaire for Departments (reworded for faculty participants)",
    instructions="Rate each statement about our department as you experience it, on a scale of 1-5. 'Faculty' means faculty in our department, including you.",
    scoring={"method": "sum", "max": 160, "bands": [
        {"min": 128, "max": 160, "label": "Exemplary and Future-Ready Learning Culture"},
        {"min": 96, "max": 127, "label": "Strong Teaching and Learning Practices"},
        {"min": 64, "max": 95, "label": "Developing Teaching and Learning Culture"},
        {"min": 32, "max": 63, "label": "Below 64 (no band defined in source)"}]})

add("d1s1", 3, "ideal_graduate", "Five Characteristics of an Ideal Graduate", "table_entry", {
    "columns": [{"id": "characteristic", "label": "Characteristic of an ideal graduate of our programme", "type": "text"}],
    "minRows": 5, "maxRows": 5},
    f"{LC2} - Case Study 4, Step 1 (p.14)",
    instructions="The University's Academic Vision states that graduates must possess deep disciplinary expertise, conceptual clarity, research capability, ethical reasoning, interdisciplinary awareness, employability and lifelong learning skills. Identify five characteristics of an ideal graduate of YOUR programme.")

# ---- D1 S-II
add("d1s2", 1, "depth_ranking", "What Does Disciplinary Depth Mean?", "rank_order", {
    "options": opts(["Conceptual understanding", "Mastery of core theories", "Critical thinking",
                     "Research capability", "Problem-solving", "Evidence-based reasoning",
                     "Ethical application of knowledge", "Communication within the discipline",
                     "Independent learning", "Innovation within the discipline"]),
    "reflections": [
        q("r1", "Which three characteristics are currently the greatest strengths of your graduates? Why?"),
        q("r2", "Which three characteristics require the greatest improvement? Why?")]},
    f"{LC2} - Worksheet: Disciplinary Depth Audit, Part A (p.16)",
    instructions="Rank the following characteristics in order of importance (1 = Most Important; 10 = Least Important).")

add("d1s2", 2, "draw_our_t", "Draw Our T: Vertical Depth vs Horizontal Breadth", "table_entry", {
    "columns": [
        {"id": "course", "label": "Course code and title", "type": "text"},
        {"id": "semester", "label": "Semester", "type": "number", "min": 1, "max": 10},
        {"id": "credits", "label": "Credits", "type": "number", "min": 0, "max": 20},
        {"id": "strand", "label": "Strand", "type": "select",
         "options": ["Vertical - disciplinary depth", "Horizontal - breadth / transferable", "Both"]}],
    "minRows": 3, "maxRows": 60,
    "computed": {"type": "ratio_by_category", "valueColumn": "credits", "categoryColumn": "strand",
                 "target": "70:30 (Vertical:Horizontal)"},
    "reflections": [
        q("r0", "Programme analysed (name and year of syllabus)", 200),
        q("r1", "How close is the programme to the 70:30 depth-to-breadth balance? Which courses are breadth 'in the syllabus' but not breadth 'in the graduate'?")]},
    f"{LC2} - T-shaped individual and the 70:30 equation (pp.3-4); {TP} - Tables 1 and 2",
    instructions="List the courses of your programme and classify each one. Vertical = specialised, in-depth domain knowledge. Horizontal = working knowledge across other areas, research methods, academic writing, digital tools, collaboration. Many experts believe the ideal T-shaped equation is 70% depth and 30% breadth.",
    group=True, derived=True)

# ---- D1 S-III
RIGOUR_SECTIONS = [
    ("A", "Curriculum Rigour", [
        "Programme Outcomes emphasise disciplinary mastery.",
        "Courses progressively increase in complexity from Year 1 to Year 4.",
        "Learning outcomes focus on conceptual understanding rather than factual recall.",
        "Threshold concepts are explicitly identified within courses.",
        "Students revisit concepts at progressively deeper levels.",
        "Curriculum integrates current disciplinary developments.",
        "The curriculum reflects international standards.",
        "Interdisciplinary learning complements rather than replaces disciplinary depth."]),
    ("B", "Teaching and Learning", [
        "Faculty explain underlying concepts rather than procedures alone.",
        "Teaching encourages questioning and critical discussion.",
        "Students engage in problem-based learning.",
        "Inquiry-based learning is regularly used.",
        "Students analyse authentic problems.",
        "Research articles are discussed in class.",
        "Students participate actively rather than passively.",
        "Faculty use multiple teaching strategies.",
        "Students receive regular formative feedback.",
        "Technology enhances conceptual learning."]),
    ("C", "Reading and Scholarship", [
        "Students read original scholarly literature.",
        "Classic texts are prescribed where appropriate.",
        "Students critically evaluate literature.",
        "Reading lists are updated annually.",
        "Faculty model scholarly reading habits.",
        "Students write literature reviews.",
        "Students evaluate evidence rather than opinions.",
        "Academic writing is explicitly taught."]),
    ("D", "Research-Led Teaching", [
        "Faculty integrate their own research into teaching.",
        "Students undertake research projects progressively.",
        "Research methodology is introduced early.",
        "Students analyse research papers.",
        "Students present research findings.",
        "Research informs curriculum revision.",
        "Industry and research challenges are discussed.",
        "Students understand research ethics."]),
    ("E", "Assessment Rigour", [
        "Assessments align with learning outcomes.",
        "Assessment measures conceptual understanding.",
        "Students solve unfamiliar problems.",
        "Assessment measures analysis and evaluation.",
        "Students create original solutions.",
        "Rubrics are transparent.",
        "Feedback improves future performance.",
        "Assessment includes authentic tasks.",
        "Assessment includes reflection.",
        "Assessment discourages rote learning."]),
    ("F", "Academic Culture", [
        "Faculty demonstrate high academic expectations.",
        "Students value intellectual curiosity.",
        "Academic integrity is consistently upheld.",
        "Faculty engage in continuous professional development.",
        "Peer review of teaching occurs regularly.",
        "Departments benchmark internationally.",
        "Innovation is encouraged without compromising rigour.",
        "Evidence informs academic decision-making."]),
]
add("d1s3", 1, "rigour_checklist", "Academic Rigour Checklist - Departmental Audit Tool", "rating_scale", {
    "scale": SCALE_1_5_EVIDENT,
    "sections": [{"id": s, "title": f"Section {s}: {t}", "items": items(s.lower(), its)} for s, t, its in RIGOUR_SECTIONS]},
    f"{LC2} - Academic Rigour Checklist, Sections A-F (pp.5-7), adapted from Biggs & Tang (2011) (reworded for faculty participants)",
    instructions="Rate our department as you experience it: 1 Not Evident, 2 Emerging, 3 Partially Established, 4 Well Established, 5 Fully Embedded. 'Faculty' means faculty in our department, including you. Your ratings are combined with your colleagues' to form the department profile.",
    scoring={"method": "sum", "max": 260, "bands": [
        {"min": 220, "max": 260, "label": "Exemplary academic rigour", "description": "The department demonstrates a mature culture of disciplinary excellence, research-informed teaching, and constructive alignment. Focus on innovation, international benchmarking, and continuous enhancement."},
        {"min": 180, "max": 219, "label": "Strong academic rigour", "description": "Most essential practices are established. Prioritise strengthening research integration, authentic assessment, and interdisciplinary connections while maintaining disciplinary depth."},
        {"min": 140, "max": 179, "label": "Developing academic rigour", "description": "Good foundations exist, but greater emphasis is needed on conceptual learning, curriculum progression, and evidence-based assessment. Develop a structured departmental improvement plan."},
        {"min": 52, "max": 139, "label": "Significant enhancement required", "description": "Review curriculum design, teaching practices, assessment strategies, and faculty development. Consider a comprehensive academic quality review and targeted interventions."}]})

add("d1s3", 2, "rigour_reflection", "Academic Rigour Checklist - Reflection and Initial Priorities", "composite", {"parts": [
    {"id": "p1", "widgetType": "free_text", "config": {"questions": [
        q("q1", "Which section received the highest score? Why do you think this is a strength?"),
        q("q2", "Which section requires the greatest improvement? What evidence supports your conclusion?"),
        q("q3", "Identify three departmental practices that currently promote academic rigour."),
        q("q4", "Identify three practices that may unintentionally reduce academic rigour."),
        q("q5", "If you could improve only one aspect of academic rigour in your own courses this academic year, what would it be? Why?")]}},
    {"id": "p2", "widgetType": "table_entry", "config": {
        "columns": [{"id": "priority", "label": "Priority", "type": "text"},
                    {"id": "action", "label": "Action", "type": "text"},
                    {"id": "person", "label": "Person Responsible", "type": "text"},
                    {"id": "timeline", "label": "Timeline", "type": "text"},
                    {"id": "indicator", "label": "Success Indicator", "type": "text"}],
        "minRows": 1, "maxRows": 3}},
]}, f"{LC2} - Reflection Questions and Department Action Plan (p.8) (reworded for faculty participants)")

add("d1s3", 3, "curriculum_for_depth", "Disciplinary Depth Audit - Curriculum for Depth", "rating_scale", {
    "scale": SCALE_1_5_DEV,
    "sections": [{"id": "B", "title": "Part B - Curriculum for Depth", "items": items("b", [
        "Students build a strong foundation in the first year.",
        "Courses increase in conceptual complexity each year.",
        "Threshold concepts are intentionally taught.",
        "Students revisit concepts at increasing levels of sophistication (spiral curriculum).",
        'The curriculum emphasises "why" and "how", not just "what".',
        "Students connect theory with practice.",
        "Advanced electives deepen disciplinary expertise.",
        "The curriculum reflects current developments in the discipline."])}]},
    f"{LC2} - Disciplinary Depth Audit, Part B (p.17)",
    scoring={"method": "sum", "max": 40, "bands": []})

add("d1s3", 4, "teaching_for_mastery", "Disciplinary Depth Audit - Teaching for Disciplinary Mastery", "choice_matrix", {
    "options": ["Never", "Occasionally", "Frequently", "Consistently"], "evidence": False,
    "items": items("c", [
        "I explain underlying concepts rather than procedures",
        'I encourage students to ask "why" questions',
        "I discuss misconceptions and conceptual errors",
        "I use discipline-specific case studies",
        "I require students to justify their reasoning",
        "I integrate current research into my teaching",
        "I model expert thinking aloud",
        "I use authentic disciplinary problems"]),
    "reflections": [q("r1", "Which of these practices has had the greatest impact on conceptual learning in your own classes? Which one will you use more often?")]},
    f"{LC2} - Disciplinary Depth Audit, Part C (p.17) (reworded for faculty participants)",
    instructions="How frequently do YOU use the following practices in your own teaching?")

add("d1s3", 5, "reading_for_depth", "Disciplinary Depth Audit - Reading for Depth", "checklist", {
    "options": opts([
        "Students read foundational texts or classic works in the discipline.",
        "Students regularly engage with peer-reviewed journal articles.",
        "Reading lists include contemporary research.",
        "Students critically analyse rather than merely summarise readings.",
        "I model scholarly reading practices for my students.",
        "Students write literature reviews.",
        "Students discuss research papers in seminars.",
        "Students compare multiple perspectives before forming conclusions."]),
    "allowOther": False,
    "reflections": [q("r1", "How could you strengthen students' scholarly reading habits in the courses you teach?")]},
    f"{LC2} - Disciplinary Depth Audit, Part E (p.19) (reworded for faculty participants)",
    instructions="Tick the practices currently followed in the courses YOU teach.")

add("d1s3", 6, "research_inquiry", "Disciplinary Depth Audit - Research and Inquiry", "choice_matrix", {
    "options": ["Yes", "Partly", "No"], "evidence": False,
    "items": items("f", [
        "Students undertake inquiry-based projects.",
        "Research methodology is introduced before the final year.",
        "Students formulate research questions.",
        "Students analyse and interpret evidence.",
        "Students communicate research findings.",
        "Students understand research ethics."]),
    "reflections": [q("r1", "How effectively does our curriculum prepare students to think like researchers? What can you add in your own courses?")]},
    f"{LC2} - Disciplinary Depth Audit, Part F (p.19)")

# ---- D1 S-IV
add("d1s4", 1, "quality_dimensions", "Five Dimensions of Academic Quality", "rating_scale", {
    "scale": SCALE_1_5_DEV,
    "sections": [{"id": "Q", "title": "Dimensions of Academic Quality", "items": items("q", [
        "Curriculum Quality - curricula remain relevant, multidisciplinary, aligned with NEP 2020, and responsive to emerging industry and societal needs.",
        "Teaching Quality - learner-centred pedagogies, active and experiential learning, inclusive practices, and effective integration of technology and AI.",
        "Assessment Quality - a shift from memory-based examinations to authentic, application-oriented, research-focused and project-based evaluation.",
        "Student Engagement - participation, mentoring, feedback mechanisms, and holistic development opportunities.",
        "Learning Outcomes - students demonstrate knowledge application, critical thinking, employability, and future-readiness."])}],
    "evidence": True},
    f"{LC1} - Session III: Dimensions of Academic Quality (reworded for faculty participants)",
    instructions="Rate our department on each dimension as you experience it, and note one piece of evidence.",
    derived=True, scoring={"method": "sum", "max": 25, "bands": []})

CS_LEVEL = ["Low", "Moderate", "High"]
add("d1s4", 2, "case1_breadth_replaces_depth", "Case Study 1 - When Breadth Replaces Depth", "composite", {
    "context": "The Department of Business Analytics at University A redesigned its undergraduate programme to make students future ready. The curriculum introduced numerous interdisciplinary courses (AI, Design Thinking, Entrepreneurship, Sustainability, Communication Skills, Innovation Labs, Leadership, FinTech, Data Visualisation). Students enjoyed the programme and course evaluations improved. After four years, employers reported that graduates struggled to explain statistical concepts, design analytical models independently, interpret research findings, justify methodological choices, and solve unfamiliar quantitative problems. Students depended heavily on software tools without understanding the underlying principles.",
    "parts": [
        {"id": "p1", "widgetType": "free_text", "config": {"questions": [
            q("q1", "What was the department trying to achieve?"),
            q("q2", "What assumptions guided the curriculum redesign?"),
            q("q3", "What unintended consequences emerged?")]}},
        {"id": "p2", "widgetType": "choice_matrix", "config": {"options": CS_LEVEL, "evidence": False,
            "items": items("d", ["Conceptual learning", "Disciplinary depth", "Research capability",
                                 "Interdisciplinary learning", "Graduate readiness"])}},
        {"id": "p3", "widgetType": "free_text", "config": {"questions": [
            q("q4", "What balance between breadth and depth would you recommend?")]}},
        {"id": "p4", "widgetType": "poll", "config": {"questions": [
            {"id": "q5", "prompt": "CHRIST context: Could this happen in your department?", "multi": False,
             "options": opts(["Yes", "No", "Partly"])}]}},
        {"id": "p5", "widgetType": "free_text", "config": {"questions": [q("q6", "Why?")]}},
    ]}, f"{LC2} - Case Study 1 (pp.10-11)", group=True)

add("d1s4", 3, "case2_results_vs_understanding", "Case Study 2 - Excellent Results but Poor Understanding", "composite", {
    "context": "The Department of Mechanical Engineering consistently produced excellent examination results: nearly 90% First Class, syllabus completed on time, attendance above 90%, feedback averaging 4.7/5. Industry partners reported that graduates struggled to solve open-ended problems, explain why a solution worked, apply principles in unfamiliar contexts, and communicate technical reasoning. A curriculum review revealed that most assessments rewarded procedural knowledge and memorisation rather than conceptual understanding.",
    "parts": [
        {"id": "p1", "widgetType": "free_text", "config": {"questions": [
            q("q1", "Diagnosis: What indicators suggested success?"),
            q("q2", "Diagnosis: What indicators suggested failure?")]}},
        {"id": "p2", "widgetType": "checklist", "config": {"allowOther": False, "options": opts([
            "Excessive content coverage", "Recall-based assessment", "Limited inquiry",
            "Poor conceptual teaching", "Lack of research exposure", "Limited authentic assessment",
            "Faculty development needs"])}, "label": "Root Cause Analysis - tick the likely causes"},
        {"id": "p3", "widgetType": "poll", "config": {"questions": [
            {"id": "q3", "prompt": "Biggs' Constructive Alignment: which element appears weakest?", "multi": False,
             "options": opts(["Learning Outcomes", "Teaching Activities", "Assessment"])}]}},
        {"id": "p4", "widgetType": "free_text", "config": {"questions": [
            q("q4", "Explain your choice."),
            q("q5", "Department reflection: Can high examination scores coexist with weak learning? Discuss.")]}},
    ]}, f"{LC2} - Case Study 2 (pp.12)", group=True)

add("d1s4", 4, "case3_research_led", "Case Study 3 - Research-led Teaching in Practice", "composite", {
    "context": "The Department of Biology redesigned its curriculum around inquiry rather than information delivery. Students read journal articles every week, discussed recent discoveries, completed laboratory investigations, presented research papers, designed mini research projects, analysed real-world datasets and participated in faculty research. Although examination averages initially declined slightly, postgraduate admissions and student research publications increased substantially over five years.",
    "parts": [
        {"id": "p1", "widgetType": "checklist", "label": "Which practices contributed to deeper learning? Tick all that apply.",
         "config": {"allowOther": False, "options": opts([
             "Reading research papers", "Inquiry", "Faculty mentoring", "Authentic assessment",
             "Research projects", "Laboratory investigation", "Critical discussion"])}},
        {"id": "p2", "widgetType": "free_text", "config": {"questions": [
            q("q1", "Long-term outcomes: What competencies developed?"),
            q("q2", "Transferability - which practices could you implement in your own courses IMMEDIATELY?"),
            q("q3", "Transferability - WITHIN ONE YEAR?"),
            q("q4", "Transferability - LONG TERM?")]}},
    ]}, f"{LC2} - Case Study 3 (p.13) (reworded for faculty participants)", group=True)

add("d1s4", 5, "case4_t_shaped_graduate", "Case Study 4 - Building a T-Shaped Graduate at CHRIST", "composite", {
    "context": "Your department has been asked to redesign its programme in line with the University's Academic Vision. You are a member of the curriculum review committee.",
    "parts": [
        {"id": "p1", "widgetType": "rating_scale", "label": "Step 2 - Rate your current programme (1 = lowest, 5 = highest)",
         "config": {"scale": {"min": 1, "max": 5, "labels": ["1", "2", "3", "4", "5"]},
                    "sections": [{"id": "S", "title": "Programme rating", "items": items("s", [
                        "Disciplinary depth", "Research integration", "Assessment rigour", "Conceptual teaching",
                        "Industry engagement", "Interdisciplinary learning", "Student inquiry", "Faculty expertise"])}]}},
        {"id": "p2", "widgetType": "free_text", "label": "Step 3 - Gap Analysis", "config": {"questions": [
            q("q1", "Current Strengths"), q("q2", "Current Weaknesses"),
            q("q3", "Immediate Opportunities"), q("q4", "Major Challenges")]}},
        {"id": "p3", "widgetType": "table_entry", "label": "Step 4 - Develop Three Strategic Priorities", "config": {
            "columns": [{"id": "priority", "label": "Priority", "type": "text"},
                        {"id": "why", "label": "Why is it important?", "type": "text"},
                        {"id": "timeline", "label": "Timeline", "type": "text"}],
            "minRows": 3, "maxRows": 3}},
    ]}, f"{LC2} - Case Study 4, Steps 2-4 (pp.14-15) (reworded for faculty participants)", group=True,
    carry={"readKeys": [], "writeKeys": ["strategicPriorities"], "writeFrom": {"strategicPriorities": "p3"}})

add("d1s4", 6, "group_discussion", "Group Discussion - Across the Four Cases", "free_text", {"questions": [
    q("q1", "Which case study most closely resembles your department? Why?"),
    q("q2", "Which academic practice from the four cases would have the greatest impact if implemented at CHRIST University?"),
    q("q3", "What are the biggest barriers to strengthening disciplinary depth in your department?"),
    q("q4", "What can you, as a faculty member, do in your own courses to build a culture that values conceptual understanding, inquiry, and academic rigour?"),
    q("q5", "What one recommendation would you make to the HoD to strengthen academic rigour in our department?")]},
    f"{LC2} - Group Discussion (p.15) (reworded for faculty participants)", group=True)

# ============================================================ DAY 2
add("d2s1", 1, "register_working_doc", "Register Your Working Document", "working_doc", {"fields": [
    {"key": "programme", "label": "Programme", "type": "text", "required": True},
    {"key": "course", "label": "Course code and title", "type": "text", "required": True},
    {"key": "semester", "label": "Semester / Year", "type": "text", "required": True},
    {"key": "discipline", "label": "Course / discipline", "type": "text", "required": True},
    {"key": "courseOutcomes", "label": "Course outcome(s) addressed", "type": "textarea", "required": False},
    {"key": "originalItem", "label": "Original assessment item (as currently written)", "type": "textarea", "required": True}]},
    f"{LC3} - Working Document Worksheet (p.10); Workshop Overview (p.2)",
    instructions="Each participant carries a single working document - one course unit or assessment - through Days 2 and 3. Use the curriculum document you brought.",
    carry={"readKeys": [], "writeKeys": ["programme", "course", "semester", "discipline", "courseOutcomes", "originalItem"]})

add("d2s1", 2, "threshold_concepts", "Threshold Concepts in Our Programme", "table_entry", {
    "columns": [{"id": "concept", "label": "Threshold Concept", "type": "text"},
                {"id": "difficulty", "label": "Why is it difficult?", "type": "text"},
                {"id": "misconceptions", "label": "Common misconceptions", "type": "text"},
                {"id": "mastery", "label": "How do students demonstrate mastery?", "type": "text"}],
    "minRows": 3, "maxRows": 8,
    "reflections": [q("r1", "Which threshold concept do students struggle with the most, and what changes in teaching could improve understanding?")]},
    f"{LC2} - Disciplinary Depth Audit, Part D - Threshold Concepts (Meyer & Land) (p.18)",
    instructions="Threshold concepts are transformative ideas that fundamentally change how students understand a discipline. Identify the threshold concepts in your programme.",
    group=True)

add("d2s1", 3, "three_must_know", "The Three Concepts Every Graduate Must Master", "table_entry", {
    "columns": [{"id": "concept", "label": "Concept students MUST deeply understand before graduation", "type": "text"},
                {"id": "where", "label": "Where in the programme is it built? (course / semester)", "type": "text"}],
    "minRows": 3, "maxRows": 3},
    f"{DW} - Part D, Dean's Challenge", group=True)

# ---- D2 S-II
add("d2s2", 1, "climbing_the_ladder", "Climbing the Ladder - A HOT Game (Optional)", "ladder_game", {
    "stimulus": "Derrida argues that an archive is never a neutral container: the technology and the institution that preserve a record also shape what can be remembered, and therefore who holds power over memory itself (paraphrased from Derrida & Prenowitz, 1995, pp. 9-63).",
    "secondsPerLevel": 60, "totalMinutes": 10,
    "levels": [
        {"level": 1, "bloom": "Remember", "points": 10, "question": "According to the stimulus, what does an archive do besides store records?"},
        {"level": 2, "bloom": "Understand", "points": 15, "question": "In your own words, explain why Derrida says an archive is never neutral."},
        {"level": 3, "bloom": "Apply", "points": 20, "question": "Name one archive you are personally familiar with (a family record, an institutional archive, a digital platform), and state, in one sentence, who currently controls what it preserves."},
        {"level": 4, "bloom": "Analyse", "points": 25, "question": "Compare two archives you know of (for example, a national archive and a personal social media account). Which one's structure more visibly shapes what can be remembered, and how?"},
        {"level": 5, "bloom": "Evaluate", "points": 30, "question": "Using Derrida's claim, judge whether a specific digitisation project you are aware of has expanded or narrowed whose memory is preserved. Justify your judgement with one piece of evidence."},
        {"level": 6, "bloom": "Create", "points": 35, "question": "Propose one specific, realistic change to an archive or record-keeping system you are familiar with that would shift control over what is preserved toward a currently under-represented group."}],
    "debrief": "At which level did the question stop being answerable from memory of the stimulus alone, and start requiring something you brought to it yourself? That level is where recall ends and Higher-Order Thinking begins."},
    f"{LC3} - Segment 3: Climbing the Ladder (pp.7-8)", group=True, timeLimitMin=10,
    instructions="A successful answer banks that level's points and unlocks the next level. An unsuccessful answer ends the climb, but banked points are kept. After any successful level the group may stop and bank its score.")

add("d2s2", 2, "doing_to_deep_learning", "Activity 1 - Mapping the Shift from Doing to Deep Learning", "composite", {
    "parts": [
        {"id": "p1", "widgetType": "choice_matrix", "label": "Traditional-sequence stage - present in this item?",
         "config": {"options": ["Present", "Absent"], "evidence": True, "items": items("t", [
             "Content", "Lecture", "Assignment", "Examination", "Grade"])}},
        {"id": "p2", "widgetType": "choice_matrix", "label": "Rigour-oriented stage",
         "config": {"options": ["Present", "Partial", "Absent"], "evidence": True, "items": items("r", [
             "Meaningful content", "Active engagement", "Application", "Analysis",
             "Evaluation", "Synthesis", "Reflection"])}},
        {"id": "p3", "widgetType": "free_text", "config": {"questions": [
            q("q1", "Priority stage: of the stages marked Partial or Absent, which single one would have the largest effect on student learning if a rigour-oriented element were added?", 500),
            q("q2", "What specific piece of evidence would you expect to see if that stage were genuinely present?"),
            q("q3", "Debrief: Is your course closer to the traditional or the rigour-oriented approach, and at which stage does it diverge most?")]}},
    ]}, f"{LC3} - Segment 4, Activity 1 and Working Document Worksheet (pp.8-10)", group=True,
    instructions="Step 1: Read both columns of 'Transforming Learning - From Doing to Deep Learning' silently. Step 2: Map your working document: which traditional stage dominates; mark each rigour-oriented stage Present (specific, checkable instance), Partial (scheduled or claimed but not required of every student) or Absent. Step 3: Identify the priority stage.",
    carry={"readKeys": ["course", "originalItem"], "writeKeys": ["priorityStage"], "writeFrom": {"priorityStage": "p3.q1"}})

add("d2s2", 3, "rewrite_working_doc", "Activity 2 - Selecting and Rewriting the Working Document", "composite", {
    "parts": [
        {"id": "p1", "widgetType": "checklist", "label": "Quick-Reference Checklist - does your rewrite pass all four conditions?",
         "config": {"allowOther": False, "options": opts([
             "Active: the task requires students to construct a response, not only receive or reproduce one.",
             "Meaningful: the content is central to what the discipline considers important, not peripheral.",
             "Higher-order: the task requires analysis, evaluation, or creation.",
             "At expectation: the demand is calibrated to this course's level and credit weight."])}},
        {"id": "p2", "widgetType": "working_doc", "config": {"fields": [
            {"key": "rewrittenItem", "label": "Rewritten assessment (redesigned, not replaced, to meet HOT requirements)", "type": "textarea", "required": True},
            {"key": "addedComponents", "label": "Added components", "type": "textarea", "required": False}]}},
        {"id": "p3", "widgetType": "fixed_grid", "label": "Justification against the four conditions",
         "config": {"rows": ["Active", "Meaningful", "Higher-order", "At expectation"],
                    "columns": ["How the rewrite addresses it"]}},
        {"id": "p4", "widgetType": "free_text", "config": {"questions": [
            q("q1", "Debrief: Did rewriting the item change what students would need to know, or only what they would need to do with what they know?")]}},
    ]}, f"{LC3} - Segment 5, Activity 2 (pp.11-12); Annexure 1 worked example (pp.14-16)", group=True,
    instructions="Step 1 Select: the item from your working document (prefer one touching the priority stage). Step 2 Rewrite in pairs so that it requires analysis, evaluation or creation. Step 3 Merge and record the final version, with one sentence justifying each of the four conditions. This is a redesign, not a replacement.",
    carry={"readKeys": ["course", "originalItem", "priorityStage"], "writeKeys": ["rewrittenItem", "addedComponents"]})

add("d2s2", 4, "hot_case_studies", "HOT Case Studies - Discussion", "free_text", {"questions": [
    q("q1", "UNESCO-IHE: What does the original problem suggest about the risk of depth without breadth, even where the depth itself is genuinely rigorous?"),
    q("q2", "UNESCO-IHE: What is the difference between a policy module assessed by a descriptive summary, and one that requires evaluating a real policy decision using technical training? Which produces breadth in the T-shaped sense?"),
    q("q3", "UNESCO-IHE: Where, in your own discipline, are graduates most likely to resemble the water professionals in this case?"),
    q("q4", "ENG405A-7B: Compare CIA-I Part A with CIA-III. Which more reliably produces HOT engagement as designed, and why?")]},
    f"{LC3} - Segment 2 Case Study 1 (p.6) and Segment 6 Case Study 2 (pp.12-13)", group=True)

# ---- D2 S-III
BLOOM = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"]
DOK = ["DOK 1 - Recall and Reproduction", "DOK 2 - Skills and Concepts",
       "DOK 3 - Strategic Thinking / Reasoning", "DOK 4 - Extended Thinking"]
add("d2s3", 1, "crm_syllabus_map", "Cognitive Rigour Matrix - Map Your Syllabus", "crm_matrix", {
    "bloom": BLOOM, "dok": DOK, "itemTypes": ["Course Outcome", "Unit", "Assessment item"],
    "minItems": 5, "maxItems": 40,
    "reflections": [
        q("r1", "What share of your items sit at DOK 3-4? Where is the course over-concentrated at lower levels?"),
        q("r2", "Which item uses a higher-order verb (e.g. 'analyse') but still sits at a low DOK level because it does not require sustained, independent reasoning?")]},
    f"{LC3} - Session 2: Depth of Knowledge, objectives and Cognitive Rigour Matrix Table 3 (pp.20-21); rDOK descriptors for Science and Mathematics (pp.26-29)",
    instructions="Bloom's Taxonomy classifies the TYPE of cognitive process a task requires; Webb's DOK classifies the COMPLEXITY of engagement required. Add each course outcome, unit and assessment item from your working syllabus and place it in one cell of the matrix.",
    derived=True, carry={"readKeys": ["course"], "writeKeys": []})

add("d2s3", 2, "crm_before_after", "Before and After: Where Did the Rewrite Move?", "composite", {"parts": [
    {"id": "p1", "widgetType": "poll", "config": {"questions": [
        {"id": "b_bloom", "prompt": "ORIGINAL item - Bloom level", "multi": False, "options": opts(BLOOM)},
        {"id": "b_dok", "prompt": "ORIGINAL item - DOK level", "multi": False, "options": opts(DOK)},
        {"id": "a_bloom", "prompt": "REWRITTEN item - Bloom level", "multi": False, "options": opts(BLOOM)},
        {"id": "a_dok", "prompt": "REWRITTEN item - DOK level", "multi": False, "options": opts(DOK)}]}},
    {"id": "p2", "widgetType": "free_text", "config": {"questions": [
        q("q1", "If the DOK level did not rise, what would the task need to require for it to reach DOK 3 or 4?")]}},
]}, f"{LC3} - The Connective Arc Across the Three-Session Day (p.30)", derived=True,
    carry={"readKeys": ["originalItem", "rewrittenItem"], "writeKeys": []})

# ---- D2 S-IV
add("d2s4", 1, "issue_based_redesign", "Issue-Based Redesign of the Working Document", "composite", {"parts": [
    {"id": "p1", "widgetType": "working_doc", "config": {"fields": [
        {"key": "unitTitle", "label": "Unit selected for redesign", "type": "text", "required": True},
        {"key": "topicFocus", "label": "Current topic-based focus (what the unit covers now)", "type": "textarea", "required": True},
        {"key": "issueQuestion", "label": "Real-world issue / question the unit will now be organised around", "type": "textarea", "required": True},
        {"key": "domainsConnected", "label": "Other domains the issue requires students to draw on", "type": "textarea", "required": True},
        {"key": "studentTask", "label": "What students will do (task / project)", "type": "textarea", "required": True},
        {"key": "targetDok", "label": "Target DOK level", "type": "select", "options": ["DOK 3", "DOK 4"], "required": True},
        {"key": "evidence", "label": "Evidence of learning (assessment)", "type": "textarea", "required": False}]}},
    {"id": "p2", "widgetType": "checklist", "label": "T-shaped check - which dimensions does the redesigned unit develop?",
     "config": {"allowOther": False, "options": opts([
         "Disciplinary depth - strong conceptual and theoretical foundations",
         "Interdisciplinary breadth - awareness of knowledge beyond one's discipline",
         "Integration - the capacity to connect ideas across domains",
         "Transfer - the ability to apply learning to new contexts",
         "Collaboration - the ability to work productively with diverse people",
         "Adaptability - the capacity to continue learning as contexts change"])}},
    {"id": "p3", "widgetType": "checklist", "label": "Integration strategies used",
     "config": {"allowOther": True, "options": opts([
         "Project-based learning (e.g. developing an application)",
         "Case studies (e.g. analysing software failures)",
         "Cross-disciplinary project (e.g. combining computing with business)",
         "Industry collaboration (live problem / guest input)",
         "Portfolio or peer assessment of group work"])}},
    {"id": "p4", "widgetType": "free_text", "config": {"questions": [
        q("q1", "What would change for students if a smaller version of this breadth were introduced earlier in the programme?")]}},
]}, f"{LC3} - Session 2: Issue-based design as the shared mechanism for depth and breadth (p.20); {LC4} - T-Shaped Learning dimensions; {TP} - Table 2 integration strategies",
    instructions="A topic-based unit organises content around a subject area; an issue-based unit organises the same content around a real-world question, requiring students to apply and integrate material from more than one domain. Reframing a unit this way typically raises it to DOK 3 or 4 and builds the horizontal component of the T at the same time.",
    group=True, derived=True,
    carry={"readKeys": ["course", "rewrittenItem"], "writeKeys": ["unitTitle", "topicFocus", "issueQuestion", "domainsConnected", "studentTask", "targetDok", "evidence"]})

# ============================================================ DAY 3
add("d3s1", 1, "vertical_map", "Map the Progression: Year 1 to Year 4", "composite", {"parts": [
    {"id": "p1", "widgetType": "poll", "config": {"questions": [
        {"id": "q0", "prompt": "Does our curriculum progressively take a student from exposure TO understanding TO application TO analysis TO mastery?",
         "multi": False, "options": opts(["Yes", "Partly", "No"])}]}},
    {"id": "p2", "widgetType": "fixed_grid", "config": {
        "rows": ["Core disciplinary knowledge", "Conceptual understanding", "Threshold concepts",
                 "Research capability", "Problem solving", "Critical thinking",
                 "Disciplinary application", "Independent learning", "Advanced/specialised knowledge"],
        "columns": ["Year 1 - Foundation", "Year 2 - Development", "Year 3 - Application", "Year 4 - Mastery"]}},
]}, f"{DW} - Part C: Building the Vertical Curriculum; {LC4} - Strategic Plan item 2 (Define the Vertical Curriculum)",
    instructions="Fill in the progression for your programme. For 3-year programmes, leave the Year 4 column for the PG / honours pathway or mark N/A.",
    group=True)

add("d3s1", 2, "vertical_diagnostics", "Diagnostic Questions on Progression", "free_text", {"questions": [
    q("q1", "Where is disciplinary depth built?"),
    q("q2", "Where is there unnecessary repetition?"),
    q("q3", "Where is there a jump in complexity that students may not be ready for?"),
    q("q4", "What should a final-year graduate know that a Year 1 student does not?"),
    q("q5", "Are we genuinely increasing depth - or simply increasing the number of courses?")]},
    f"{DW} - Part C: Dean's Diagnostic Questions (adapted to programme level)", group=True)

add("d3s1", 3, "concept_progression", "Placing Concepts on the Vertical", "table_entry", {
    "columns": [{"id": "concept", "label": "Concept", "type": "text"},
                {"id": "level", "label": "Level", "type": "select", "options": ["Foundational", "Intermediate", "Advanced"]},
                {"id": "introduced", "label": "Introduced in (course / semester)", "type": "text"},
                {"id": "deepened", "label": "Revisited and deepened in", "type": "text"},
                {"id": "exitBloom", "label": "Bloom level expected at exit", "type": "select", "options": BLOOM}],
    "minRows": 3, "maxRows": 15},
    f"{LC4} - Strategic Plan items 2-4 (foundational, intermediate and advanced concepts; cognitive progression using Bloom's Revised Taxonomy)",
    instructions="Carry forward the threshold concepts identified on Day 2 and place each one on the vertical.",
    group=True, derived=True)

# ---- D3 S-II
add("d3s2", 1, "assessment_audit", "Assessment Audit and Red Flag", "composite", {"parts": [
    {"id": "p1", "widgetType": "choice_matrix", "config": {"options": ["Yes", "Partly", "No"], "evidence": False,
        "items": items("a", [
            "Do my assessments test conceptual understanding?",
            "Do my students solve unfamiliar problems?",
            "Are higher-order cognitive skills assessed in my courses?",
            "Do I use authentic tasks?",
            "Do I use research-based assessments?",
            "Are my rubrics transparent to students?",
            "Does my feedback improve subsequent learning?",
            "Is rote memorisation minimised in my assessments?"])}},
    {"id": "p2", "widgetType": "free_text", "config": {"questions": [
        q("q1", "Red Flag: Identify one assessment practice in your own courses that may be creating an illusion of academic success without demonstrating deep learning.")]}},
]}, f"{DW} - Part F: Assessment Rigour (reworded for faculty participants)",
    instructions="Audit the assessments in the courses YOU teach. Move assessment beyond memorisation toward conceptual understanding, unfamiliar problems, analysis, evaluation, original solutions, authentic tasks and reflection.")

add("d3s2", 2, "assessment_methods", "Assessment Methods for Disciplinary Depth", "choice_matrix", {
    "options": ["Frequently", "Occasionally", "Rarely"], "evidence": False,
    "items": items("g", ["Open-ended problem solving", "Case analysis", "Research projects", "Concept maps",
                         "Oral examinations/viva", "Critical reviews", "Design challenges", "Portfolio assessment"]),
    "reflections": [q("r1", "Which assessment methods most effectively measure conceptual mastery rather than memorisation? Which one will you add to your own course?")]},
    f"{LC2} - Disciplinary Depth Audit, Part G (p.20) (reworded for faculty participants)",
    instructions="How often do YOU use each method to evaluate deep understanding in your courses?")

add("d3s2", 3, "authentic_task_rubric", "Design an Authentic Task and Rubric", "composite", {"parts": [
    {"id": "p1", "widgetType": "working_doc", "config": {"fields": [
        {"key": "taskTitle", "label": "Task title", "type": "text", "required": True},
        {"key": "taskScenario", "label": "Authentic scenario / real-world context", "type": "textarea", "required": True},
        {"key": "taskProduct", "label": "What students produce", "type": "textarea", "required": True},
        {"key": "taskCOs", "label": "Course outcome(s) assessed", "type": "text", "required": True},
        {"key": "taskDok", "label": "Target DOK level", "type": "select", "options": ["DOK 3", "DOK 4"], "required": True}]}},
    {"id": "p2", "widgetType": "table_entry", "label": "Analytic rubric", "config": {
        "columns": [{"id": "criterion", "label": "Criterion", "type": "text"},
                    {"id": "weight", "label": "Weight (%)", "type": "number", "min": 0, "max": 100},
                    {"id": "excellent", "label": "Excellent", "type": "text"},
                    {"id": "proficient", "label": "Proficient", "type": "text"},
                    {"id": "developing", "label": "Developing", "type": "text"},
                    {"id": "beginning", "label": "Beginning", "type": "text"}],
        "minRows": 3, "maxRows": 6,
        "computed": {"type": "sum", "column": "weight", "expect": 100}}},
    {"id": "p3", "widgetType": "checklist", "label": "Check the task against the four conditions",
     "config": {"allowOther": False, "options": opts(["Active", "Meaningful", "Higher-order", "At expectation"])}},
]}, f"{LC4} - Features of Academic Rigour 13 (Authentic Assessment) and 18 (Constructive Feedback); {TP} - Table 2 assessment methods; {LC3} - four conditions (p.11). Rubric template: not in sources.",
    group=True, derived=True,
    carry={"readKeys": ["course", "rewrittenItem", "issueQuestion"], "writeKeys": ["taskTitle", "taskScenario", "taskProduct", "taskCOs", "taskDok"]})

# ---- D3 S-III
add("d3s3", 1, "locate_redesign", "Quick Activity - Locate Your Own Redesign", "free_text", {"questions": [
    q("q1", "Write one sentence describing what you changed.", 500),
    q("q2", "Now write one honest sentence answering: \"How would I actually know if it worked?\"", 500)]},
    f"{LC3} - Session 3, Quick Activity (p.30)", timeLimitMin=3,
    carry={"readKeys": ["originalItem", "rewrittenItem"], "writeKeys": []})

SCH = ["Discovery", "Integration", "Application", "Teaching"]
add("d3s3", 2, "sort_scholarship", "Quick Activity - Sort the Scholarship", "composite", {"parts": [
    {"id": "p1", "widgetType": "poll", "config": {"questions": [
        {"id": "a", "prompt": "(a) A faculty member publishes original lab findings.", "multi": False, "options": opts(SCH)},
        {"id": "b", "prompt": "(b) A faculty member writes a synthesis connecting three disciplines.", "multi": False, "options": opts(SCH)},
        {"id": "c", "prompt": "(c) A faculty member applies research to solve a local farming problem.", "multi": False, "options": opts(SCH)},
        {"id": "d", "prompt": "(d) A faculty member systematically studies a new teaching method and shares the findings.", "multi": False, "options": opts(SCH)},
        {"id": "least", "prompt": "Which category does your department currently produce the LEAST of?", "multi": False, "options": opts(SCH)}]}},
    {"id": "p2", "widgetType": "fixed_grid", "label": "One example from your own department for each category",
     "config": {"rows": SCH, "columns": ["Example"]}},
]}, f"{LC3} - Session 3, Boyer's Four Scholarships and Quick Activity (pp.31-32)", timeLimitMin=4)

add("d3s3", 3, "meera_ladder", "Quick Activity - Where Are You on Meera's Ladder?", "composite", {"parts": [
    {"id": "p1", "widgetType": "poll", "config": {"questions": [
        {"id": "q1", "prompt": "Honestly place your redesign on Dr. Meera's four-step ladder.", "multi": False,
         "options": opts(["Theory-guided redesign only", "Privately reflective",
                          "Evidence-based (Scholarly Teaching)", "Made public (SoTL)"])}]}},
    {"id": "p2", "widgetType": "free_text", "config": {"questions": [
        q("q2", "The single next step that would move it one rung higher (not the whole ladder, just one step).", 500),
        q("q3", "What is actually stopping you from taking that one step?", 500)]}},
]}, f"{LC3} - Session 3, Potter & Kustra (2011) and Worked Example: Dr. Meera (pp.32-33)", timeLimitMin=3)

add("d3s3", 4, "felten_audit", "Quick Activity - Audit One of Your Own Activities (Felten's Five Principles)", "composite", {"parts": [
    {"id": "p1", "widgetType": "free_text", "config": {"questions": [
        q("q0", "The teaching-related activity you are auditing (a curriculum tweak, an assessment redesign, informal feedback collection):", 300)]}},
    {"id": "p2", "widgetType": "choice_matrix", "config": {"options": ["Yes", "Partial", "No"], "evidence": False,
        "items": items("f", ["Inquiry focused on student learning", "Grounded in context", "Methodologically sound",
                             "Conducted in partnership with students", "Appropriately public"])}},
    {"id": "p3", "widgetType": "free_text", "config": {"questions": [
        q("q1", "The smallest possible step that would raise your weakest score by one level (Partial to Yes, or No to Partial).", 500)]}},
]}, f"{LC3} - Session 3, Felten (2013) Five Principles and Quick Activity (pp.34-37)", timeLimitMin=5)

add("d3s3", 5, "department_position", "Quick Activities - Our Department's SoTL Position", "composite", {"parts": [
    {"id": "p1", "widgetType": "poll", "config": {"questions": [
        {"id": "q1", "prompt": "Which idea on the 1990-2023 timeline feels most absent from our department's current practice?", "multi": False,
         "options": opts(["The basic legitimacy of teaching as scholarship (Boyer, 1990)",
                          "The public/private distinction (Potter & Kustra, 2011)",
                          "The quality principles (Felten, 2013)"])},
        {"id": "q2", "prompt": "Which limitation feels most relevant to our department right now?", "multi": False,
         "options": opts(["The participation gap", "The messiness critique", "Scholarship of Practice"])}]}},
    {"id": "p2", "widgetType": "free_text", "config": {"questions": [
        q("q3", "One concrete reason why that idea has been slow to take hold in our context.", 500),
        q("q4", "Participation gap: one activity where students could realistically be consulted before, not just after, it runs. / Messiness: one inquiry you have been putting off because it felt 'not rigorous enough'. / Scholarship of Practice: one piece of your own academic practice this year (a course redesign, mentoring or committee work) that deserves to be written up and shared.", 800),
        q("q5", "Could a small group in our department take on a collective, department-wide SoTL inquiry (as in Kahn et al., 2013)? Name one colleague you could realistically approach.", 500)]}},
]}, f"{LC3} - Session 3, Timeline, Published Case Studies, Limitations and Quick Activities (pp.38-42) (reworded for faculty participants)")

add("d3s3", 6, "sotl_inquiry_plan", "SoTL Inquiry Plan for Your Redesign", "composite", {"parts": [
    {"id": "p1", "widgetType": "poll", "config": {"questions": [
        {"id": "type", "prompt": "Which question type is closest to your inquiry?", "multi": False, "options": opts([
            "Why are students struggling with a particular concept?",
            "Does a new assessment strategy improve higher-order thinking?",
            "Does interdisciplinary learning improve students' ability to transfer knowledge?",
            "What forms of feedback actually improve student performance?",
            "How does authentic assessment influence student engagement?",
            "What happens when AI-enabled tools are integrated into learning?",
            "Which pedagogies produce stronger evidence of conceptual understanding?"])}]}},
    {"id": "p2", "widgetType": "working_doc", "config": {"fields": [
        {"key": "sotlQuestion", "label": "Inquiry question (about student learning, not your technique)", "type": "textarea", "required": True},
        {"key": "sotlIntervention", "label": "Intervention (your redesign)", "type": "textarea", "required": True},
        {"key": "sotlEvidence", "label": "Evidence to be collected (e.g. identical concept test before and after, two sections)", "type": "textarea", "required": True},
        {"key": "sotlPartnership", "label": "How students will test-drive the measurement tool before it is used", "type": "textarea", "required": False},
        {"key": "sotlPublic", "label": "Where it will be made public (teaching circle, conference, repository, journal)", "type": "text", "required": True},
        {"key": "sotlTimeline", "label": "Timeline", "type": "text", "required": True}]}},
]}, f"{LC3} - Session 3, Felten's five principles and Dr. Arjun worked example (pp.34-36); {LC4} - SoTL example questions",
    derived=True,
    carry={"readKeys": ["rewrittenItem", "taskTitle"], "writeKeys": ["sotlQuestion", "sotlIntervention", "sotlEvidence", "sotlPartnership", "sotlPublic", "sotlTimeline"]})

# ---- D3 S-IV
STRATEGIC = [
    "1. Departmental Academic Rigour Audit - complete the Academic Rigour Checklist and identify strengths, gaps and priorities.",
    "2. Define the Vertical Curriculum - map disciplinary depth from Year I to Year IV (foundational, intermediate and advanced concepts).",
    "3. Threshold Concepts Mapping - identify threshold concepts for every major course and redesign teaching around conceptual mastery.",
    "4. Curriculum Progression Framework - every semester increases cognitive complexity using Bloom's Revised Taxonomy.",
    "5. Reading Culture Initiative - foundational books, landmark papers and weekly scholarly reading discussions.",
    "6. Research-led Teaching - faculty research, journal discussions, mini research projects and inquiry-based learning in UG teaching.",
    "7. Assessment Reform - assessments evaluate conceptual understanding, reasoning, problem solving and authentic application.",
    "8. Faculty Development - FDPs on conceptual teaching, inquiry-based learning, constructive alignment and authentic assessment.",
    "9. Department Benchmarking - curriculum, pedagogy and research practices against leading international universities.",
    "10. Academic Mentoring - for academically talented students and students requiring conceptual support.",
    "11. Student Research Culture - UG research seminars, poster presentations and publication opportunities.",
    "12. Academic Quality Reviews - peer observation and departmental academic quality reviews focusing on conceptual teaching.",
    "13. AI for Deep Learning - AI tools for conceptual understanding, simulations and scholarly exploration with academic integrity.",
    "14. Signature Department Initiative - one distinctive practice that demonstrates disciplinary excellence.",
    "15. Annual Review - measure progress using academic rigour scores, student learning evidence and curriculum improvements.",
]
add("d3s4", 1, "strategic_plan_15", "My Contribution to the Strategic Plan 2026-27", "fixed_grid", {
    "rows": STRATEGIC,
    "columns": ["What I will do in my course(s)", "Timeline", "Evidence I will show"]},
    f"{LC4} / {DW} - Strategic Plan: Teaching-learning for Global Competence (2026-2027), 15 strategic focus areas (reworded for faculty participants)",
    instructions="The University's 15 strategic focus areas for 2026-27 are listed below. For the areas where you can contribute through your own teaching, write what you will do, by when, and what evidence you will show. Leave the rest blank.")

add("d3s4", 2, "priority_matrix", "Priority Matrix", "table_entry", {
    "columns": [{"id": "priority", "label": "Priority", "type": "text"},
                {"id": "impact", "label": "Impact 1-5", "type": "number", "min": 1, "max": 5},
                {"id": "urgency", "label": "Urgency 1-5", "type": "number", "min": 1, "max": 5},
                {"id": "feasibility", "label": "Feasibility 1-5", "type": "number", "min": 1, "max": 5}],
    "minRows": 3, "maxRows": 5,
    "computed": {"type": "row_sum", "columns": ["impact", "urgency", "feasibility"], "label": "Overall (/15)"}},
    f"{DW} - Part I: Departmental Priority Matrix",
    instructions="As a group, identify three to five priorities for our department and score each one. Start from the three strategic priorities your group set on Day 1 (Case Study 4).",
    group=True, carry={"readKeys": ["strategicPriorities"], "writeKeys": []})

add("d3s4", 3, "department_action_plan", "Department Curriculum Action Plan", "fixed_grid", {
    "rows": ["1. Curriculum Depth", "2. Teaching & Learning", "3. Assessment Rigour", "4. Research Integration",
             "5. Scholarly Culture", "6. Faculty Development", "7. Student Research", "8. Benchmarking"],
    "columns": ["What will we change?", "Programme(s) / course(s)", "What our group will contribute",
                "Support needed from HoD / department", "Timeline", "Evidence of success"]},
    f"{DW} - Part J: School Action Plan (adapted to department level) (reworded for faculty participants)", group=True,
    instructions="Propose the department's curriculum action plan from your group's perspective. The HoD will consolidate all groups' proposals.")

add("d3s4", 4, "signature_initiative", "Propose a Signature Academic Initiative for Our Department", "working_doc", {"fields": [
    {"key": "sigName", "label": "Name", "type": "text", "required": True},
    {"key": "sigProblem", "label": "Problem it addresses", "type": "textarea", "required": True},
    {"key": "sigDifferent", "label": "What will be different?", "type": "textarea", "required": True},
    {"key": "sigProgrammes", "label": "Which programmes are involved?", "type": "text", "required": True},
    {"key": "sigStudent", "label": "Student impact", "type": "textarea", "required": True},
    {"key": "sigFaculty", "label": "Faculty impact", "type": "textarea", "required": False},
    {"key": "sigEvidence", "label": "Evidence of success", "type": "textarea", "required": True},
    {"key": "sigLaunch", "label": "Launch date", "type": "text", "required": False},
    {"key": "sigReview", "label": "Review date", "type": "text", "required": False}]},
    f"{DW} - Part K: Signature Initiative", group=True,
    carry={"readKeys": [], "writeKeys": ["sigName", "sigProblem", "sigDifferent", "sigProgrammes", "sigStudent", "sigFaculty", "sigEvidence", "sigLaunch", "sigReview"]})

add("d3s4", 5, "ninety_day_plan", "My Next 90 Days", "fixed_grid", {
    "rows": ["Complete the rigour audit for my course(s)", "Identify the top 3 gaps in my course(s)",
             "Place my course(s) on the programme's vertical map", "Identify the threshold concepts in my course(s)",
             "Redesign one assessment for higher-order learning", "Identify my own professional development needs",
             "Add one research-led teaching activity to my course", "Begin my SoTL inquiry"],
    "columns": ["Deadline", "Evidence"]},
    f"{DW} - Part L: 90-Day Action Plan (adapted to the individual faculty member) (reworded for faculty participants)")

add("d3s4", 6, "scorecard_15", "15-Point Academic Excellence Scorecard (Baseline)", "rating_scale", {
    "scale": SCALE_1_5_DEV, "evidence": True,
    "sections": [{"id": "S", "title": "Rate our department's current position, as you experience it", "items": items("s", [
        "Academic Rigour Audit completed", "Vertical curriculum mapped Year 1-4", "Threshold concepts identified",
        "Cognitive progression established", "Scholarly reading embedded", "Research-led teaching embedded",
        "Assessment rigour strengthened", "Faculty development undertaken", "International benchmarking undertaken",
        "Academic mentoring strengthened", "Student research culture developed", "Academic quality reviews conducted",
        "AI used to deepen learning", "Signature academic initiative developed", "Annual evidence-based review established"])}]},
    f"{DW} - Part B: The 15-Point Academic Excellence Scorecard (adapted to department level) (reworded for faculty participants)",
    scoring={"method": "sum", "max": 75, "bands": []})

add("d3s4", 7, "dare_closing", "Closing Reflection: D-A-R-E for My Course", "free_text", {"questions": [
    q("q1", "D - DIAGNOSE: Where is my course now?"),
    q("q2", "A - ALIGN: Where should disciplinary depth and rigour be in my course?"),
    q("q3", "R - REDESIGN: What must change in my curriculum, teaching, assessment and research integration?"),
    q("q4", "E - EVIDENCE: What measurable evidence will show that my students are learning more deeply?"),
    q("q5", "My commitment: what I want our department to be known for by 2030, and the one change I will make in my teaching next semester to contribute to it.")]},
    f"{DW} - The Dean's Leadership Logic: D-A-R-E model; {LC1} - Closing: Reflection and Way Forward (reworded for faculty participants)")

# ---------------------------------------------------------------- instructions & group set-up
GROUP_PROTOCOL = ("GROUP ACTIVITY - 1) Sit with your group as directed by the facilitator. "
    "2) Select your group number from the list; every member of the group must select the SAME number. "
    "3) Discuss and agree. 4) Each member records the answers in their OWN response and submits. "
    "The HoD sees the responses grouped by group number. Where the instructions say 'your own course', record your own course, not the group's.")

GROUP_SETUP = {
    "d1s2_a2_draw_our_t": "Programme teams: 3-6 faculty who teach in the same programme",
    "d1s4_a2_case1_breadth_replaces_depth": "Case-study groups: 4-6 members, mixed programmes; the facilitator assigns one case per group",
    "d1s4_a3_case2_results_vs_understanding": "Case-study groups: 4-6 members, mixed programmes; the facilitator assigns one case per group",
    "d1s4_a4_case3_research_led": "Case-study groups: 4-6 members, mixed programmes; the facilitator assigns one case per group",
    "d1s4_a5_case4_t_shaped_graduate": "Case-study groups: 4-6 members, mixed programmes; the facilitator assigns one case per group",
    "d1s4_a6_group_discussion": "Same case-study groups as the previous activity",
    "d2s1_a2_threshold_concepts": "Programme teams: 3-6 faculty who teach in the same programme",
    "d2s1_a3_three_must_know": "Same programme teams as the previous activity",
    "d2s2_a1_climbing_the_ladder": "Groups of 4-6 (any mix)",
    "d2s2_a2_doing_to_deep_learning": "Groups of 3-4 from the same or related discipline; each member maps their OWN working document",
    "d2s2_a3_rewrite_working_doc": "Same groups; rewrite in pairs, but each member records the rewrite of their OWN working document",
    "d2s2_a4_hot_case_studies": "Same groups as Activities 1 and 2",
    "d2s4_a1_issue_based_redesign": "Groups of 3 from the same programme; each member redesigns a unit of their OWN course",
    "d3s1_a1_vertical_map": "Programme teams: all faculty teaching in the same programme (3-6 per group; split large programmes by year)",
    "d3s1_a2_vertical_diagnostics": "Same programme teams as the previous activity",
    "d3s1_a3_concept_progression": "Same programme teams as the previous activity",
    "d3s2_a3_authentic_task_rubric": "Pairs or groups of 3 from related courses; each member designs a task for their OWN course",
    "d3s4_a2_priority_matrix": "Groups of 4-6, mixed programmes",
    "d3s4_a3_department_action_plan": "Same groups as the Priority Matrix",
    "d3s4_a4_signature_initiative": "Same groups as the Priority Matrix",
}

CASE_STEPS = ("The facilitator assigns one case to each group. Read the case aloud in your group (3 min), "
              "discuss the questions (15 min) and agree on your group's answers. One member presents to the room (3 min). Suggested time: 25 min.")

INSTR = {
    # Day 1
    "d1s3_a2_rigour_reflection": "Use your section scores from the Academic Rigour Checklist (previous activity) to answer. Then list up to three priorities you would propose, with the person responsible, a timeline and a success indicator. Suggested time: 15 min.",
    "d1s3_a3_curriculum_for_depth": "Rate the programme you teach in most, for each statement: 1 Not Evident, 2 Emerging, 3 Developing, 4 Well Established, 5 Fully Embedded. Suggested time: 5 min.",
    "d1s3_a6_research_inquiry": "Answer Yes, Partly or No for the programme you teach in most. Suggested time: 5 min.",
    "d1s4_a2_case1_breadth_replaces_depth": CASE_STEPS,
    "d1s4_a3_case2_results_vs_understanding": CASE_STEPS,
    "d1s4_a4_case3_research_led": CASE_STEPS,
    "d1s4_a5_case4_t_shaped_graduate": CASE_STEPS + " Use the ideal-graduate characteristics you listed in Session I. Your group's three strategic priorities are carried forward to the Day 3 Priority Matrix.",
    "d1s4_a6_group_discussion": "After the case presentations, discuss these questions across all four cases in your group. Suggested time: 15 min.",
    # Day 2
    "d2s1_a3_three_must_know": "Agree, as a programme team, on the three concepts every graduate of your programme must deeply understand before graduation, and where in the programme each is built. Suggested time: 10 min.",
    "d2s2_a4_hot_case_studies": "Read the two case summaries above and discuss the questions in your group. Suggested time: 15 min.",
    "d2s3_a2_crm_before_after": "Individual. Place your ORIGINAL assessment item and your REWRITTEN item (both shown above from your working document) on Bloom's Taxonomy and on Webb's DOK. Suggested time: 10 min.",
    # Day 3
    "d3s1_a2_vertical_diagnostics": "Use the Year 1 to Year 4 map your programme team has just completed to answer these questions. Suggested time: 15 min.",
    "d3s2_a3_authentic_task_rubric": "Design one authentic assessment task for YOUR OWN course and an analytic rubric for it (weights must total 100%). Partners review each task against the four conditions before you submit. Suggested time: 35 min.",
    "d3s3_a1_locate_redesign": "Individual, 3 minutes. Think of the assessment you redesigned on Day 2 (shown above). Keep this note: you will return to it in the next activities.",
    "d3s3_a2_sort_scholarship": "Individual, 4 minutes. Sort each example into one of Boyer's four scholarships, then give one example from our department for each category.",
    "d3s3_a3_meera_ladder": "Individual, 3 minutes. Return to the redesign you noted earlier and place it honestly on Dr. Meera's four-step ladder: theory-guided only / privately reflective / evidence-based (Scholarly Teaching) / made public (SoTL).",
    "d3s3_a4_felten_audit": "Individual, 5 minutes. Choose one existing teaching-related activity and score it against Felten's five principles. Most activities score well on the first three and weakly on the last two; check whether that holds for yours.",
    "d3s3_a5_department_position": "Individual. Answer after the facilitator presents the SoTL timeline, the two published case studies and the limitations. Suggested time: 10 min.",
    "d3s3_a6_sotl_inquiry_plan": "Individual. Turn your Day 2 redesign into a small, honest inquiry you can run next semester. A small claim needs only modest evidence; what matters is that it is systematic and shared. Suggested time: 15 min.",
    "d3s4_a4_signature_initiative": "Propose ONE distinctive initiative that would demonstrate disciplinary excellence in our department. The HoD will review all groups' proposals. Suggested time: 20 min.",
    "d3s4_a5_ninety_day_plan": "Individual. Set a realistic deadline (on or before 29 December 2026) and the evidence you will produce for each action. Suggested time: 10 min.",
    "d3s4_a6_scorecard_15": "Individual. Rate our department's current position on each area as you experience it, with one piece of evidence where you can. This becomes the baseline for next year's review. Suggested time: 5 min.",
    "d3s4_a7_dare_closing": "Individual. The last activity of the QIP: reflect on your own course using the D-A-R-E logic and record one commitment. Suggested time: 10 min.",
}

CONTEXT = {
    "d2s2_a4_hot_case_studies": (
        "CASE 1 - T-Shaped Reform in Water Professional Education (UNESCO-IHE; Uhlenbrook, Kolokytha & de Boer, 2012): "
        "graduates with strong technical training in hydrology and engineering were consistently unable to influence real water policy "
        "and governance outcomes, because their curricula had never required them to engage, at an analytical or evaluative level, with the "
        "social, institutional and policy dimensions of water management. The reform did not add policy content as a separate module; it "
        "required students to analyse and evaluate real policy problems using their technical expertise.\n\n"
        "CASE 2 - ENG405A-7B, Memory Machines: The Politics of Digital Preservation (CHRIST, English and Cultural Studies): the course's depth "
        "comes from archive theory (Derrida, Mbembe, Caswell) and decolonising frameworks; its breadth is concentrated in Units III and IV "
        "(digital archiving platforms, metadata standards, WCAG accessibility, community-based participatory methods). CO3 is assessed through "
        "the CIA-III capstone (build a small digital archive) at Analyse/Evaluate/Create. By contrast, CIA-I Part A (a critical essay on archive "
        "theory) uses HOT-adjacent verbs that a competent essay can satisfy at Understand or Apply level if the rubric does not require analysis, "
        "evaluation or synthesis."),
}

CONFIDENTIAL = {"d1s1_a2_tl_questionnaire", "d1s3_a1_rigour_checklist", "d1s3_a3_curriculum_for_depth",
                "d1s4_a1_quality_dimensions", "d3s4_a6_scorecard_15"}
CONF_NOTE = (" CONFIDENTIAL: your HoD, Dean, Associate Dean and HRDC see only department averages "
             "(shown once at least 5 colleagues have responded) and written comments without names. They can see THAT "
             "you have submitted, but not your individual ratings. Individual responses are accessible only to the App "
             "Admin, who generates the department summary.")

for a in activities:
    aid = a["activityId"]
    if aid in INSTR:
        assert not a["instructions"], f"{aid} already has instructions"
        a["instructions"] = INSTR[aid]
    if aid in CONTEXT:
        a["config"]["context"] = CONTEXT[aid]
    if a["groupMode"] == "group":
        assert aid in GROUP_SETUP, f"group activity without groupSetup: {aid}"
        a["groupSetup"] = GROUP_SETUP[aid]
    else:
        assert aid not in GROUP_SETUP, f"groupSetup on individual activity: {aid}"
    assert a["instructions"].strip(), f"activity without instructions: {aid}"
    a["confidential"] = aid in CONFIDENTIAL
    if a["confidential"]:
        assert a["widgetType"] == "rating_scale", aid
        a["instructions"] = a["instructions"].rstrip() + CONF_NOTE
assert set(INSTR) <= {a["activityId"] for a in activities}
assert CONFIDENTIAL <= {a["activityId"] for a in activities}
assert set(GROUP_SETUP) <= {a["activityId"] for a in activities}

# ---------------------------------------------------------------- write out
json.dump({"version": "1.0", "programme": "HRDC QIP - Shaping Future-Ready Graduates (28-30 Sept 2026)",
           "sessions": sessions}, open("seed/sessions.json", "w"), indent=2, ensure_ascii=False)
json.dump({"version": "1.1", "groupProtocol": GROUP_PROTOCOL, "groupLabels": [f"Group {i}" for i in range(1, 21)],
           "activities": activities}, open("seed/activities.json", "w"), indent=2, ensure_ascii=False)

# ---------------------------------------------------------------- JSON Schema
WIDGETS = ["rating_scale", "choice_matrix", "rank_order", "checklist", "table_entry", "fixed_grid",
           "crm_matrix", "free_text", "working_doc", "poll", "ladder_game", "composite"]
schema = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "QIP activities seed",
    "type": "object", "required": ["version", "activities"],
    "properties": {
        "version": {"type": "string"},
        "groupProtocol": {"type": "string"},
        "groupLabels": {"type": "array", "items": {"type": "string", "maxLength": 40}},
        "activities": {"type": "array", "items": {"$ref": "#/$defs/activity"}}},
    "$defs": {
        "reflection": {"type": "object", "required": ["id", "prompt"],
                       "properties": {"id": {"type": "string"}, "prompt": {"type": "string"},
                                      "maxChars": {"type": "integer", "minimum": 50, "maximum": 5000}}},
        "item": {"type": "object", "required": ["id", "text"],
                 "properties": {"id": {"type": "string"}, "text": {"type": "string"}}},
        "activity": {
            "type": "object",
            "required": ["activityId", "sessionId", "order", "title", "widgetType", "config", "sourceRef", "groupMode", "derived", "confidential"],
            "properties": {
                "activityId": {"type": "string", "pattern": "^d[1-3]s[1-4]_a[0-9]+_[a-z0-9_]+$"},
                "sessionId": {"type": "string", "pattern": "^d[1-3]s[1-4]$"},
                "order": {"type": "integer", "minimum": 1},
                "title": {"type": "string", "minLength": 3},
                "instructions": {"type": "string"},
                "widgetType": {"enum": WIDGETS},
                "config": {"type": "object"},
                "sourceRef": {"type": "string"},
                "groupMode": {"enum": ["individual", "group"]},
                "groupSetup": {"type": "string"},
                "confidential": {"type": "boolean"},
                "derived": {"type": "boolean"},
                "timeLimitMin": {"type": "integer", "minimum": 1, "maximum": 120},
                "carryForward": {"type": "object", "properties": {
                    "readKeys": {"type": "array", "items": {"type": "string"}},
                    "writeKeys": {"type": "array", "items": {"type": "string"}},
                    "writeFrom": {"type": "object", "additionalProperties": {"type": "string"}}},
                    "additionalProperties": False},
                "scoring": {"type": "object", "required": ["method"], "properties": {
                    "method": {"enum": ["sum"]}, "max": {"type": "integer"},
                    "bands": {"type": "array", "items": {"type": "object", "required": ["min", "max", "label"]}}}}},
            "additionalProperties": False}},
}
json.dump(schema, open("seed/activities.schema.json", "w"), indent=2)

# ---------------------------------------------------------------- self-checks
ids = [a["activityId"] for a in activities]
assert len(ids) == len(set(ids)), "duplicate activityId"
sess_ids = {s["sessionId"] for s in sessions}
for a in activities:
    assert a["sessionId"] in sess_ids
    assert a["activityId"].startswith(a["sessionId"] + "_")
    if a["widgetType"] == "rating_scale" and "scoring" in a:
        n = sum(len(s["items"]) for s in a["config"]["sections"])
        assert n * a["config"]["scale"]["max"] == a["scoring"]["max"], (a["activityId"], n)
# every readKey must be written by an EARLIER activity
order = {s["sessionId"]: s["order"] for s in sessions}
written = {}
for a in sorted(activities, key=lambda x: (order[x["sessionId"]], x["order"])):
    for k in a.get("carryForward", {}).get("readKeys", []):
        assert k in written, f"{a['activityId']} reads {k} before it is written"
    for k in a.get("carryForward", {}).get("writeKeys", []):
        written.setdefault(k, a["activityId"])
print(f"sessions={len(sessions)} activities={len(activities)} derived={sum(a['derived'] for a in activities)}")
for s in sessions:
    n = sum(1 for a in activities if a["sessionId"] == s["sessionId"])
    print(s["sessionId"], n, s["title"][:60])
