-- Add product-level question formats for contextual application pipelines.

alter type public.question_type add value if not exists 'short_answer';
alter type public.question_type add value if not exists 'written_answer';
alter type public.question_type add value if not exists 'scenario';
alter type public.question_type add value if not exists 'prioritization';
alter type public.question_type add value if not exists 'problem_solving';
