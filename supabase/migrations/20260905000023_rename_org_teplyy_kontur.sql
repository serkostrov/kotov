-- Rebrand organization display name.
update public.organization_profile
set name = 'Теплый контур'
where name is distinct from 'Теплый контур';
