-- Create table for beta access requests
create table public.beta_requests (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    email text not null,
    phone text,
    company text,
    position text,
    status text default 'pending' check (status in ('pending', 'contacted', 'approved', 'rejected'))
);

-- Enable RLS
alter table public.beta_requests enable row level security;

-- Create policy for insertion (public)
create policy "Anyone can submit a beta request"
on public.beta_requests
for insert
with check (true);

-- Create policy for viewing (service role or admins)
create policy "Admins can view beta requests"
on public.beta_requests
for select
using (auth.role() = 'authenticated');
