-- Beta accounts match the four sign-in choices already shown in the client.
-- Password is NexusPass123!; these deliberately public beta accounts are
-- rehashed with the Worker password pepper on their first successful login.
INSERT OR IGNORE INTO users (id, username, email, hashed_password, role, is_active, is_verified, created_at)
VALUES
('10000000-0000-4000-8000-000000000001','student1','student1@iisertirupati.ac.in','pbkdf2_sha256$100000$oDSLLpjPJ9ovOmYNhumg0Q$dCExGLPsc8cJbnEPm0lYyLj2BF0RoIIoWyE_pXBiU1w','student',1,1,'2026-11-05T00:00:00+00:00'),
('10000000-0000-4000-8000-000000000002','student2','student2@iisertirupati.ac.in','pbkdf2_sha256$100000$oDSLLpjPJ9ovOmYNhumg0Q$dCExGLPsc8cJbnEPm0lYyLj2BF0RoIIoWyE_pXBiU1w','student',1,1,'2026-11-05T00:00:00+00:00'),
('10000000-0000-4000-8000-000000000003','student3','student3@iisertirupati.ac.in','pbkdf2_sha256$100000$oDSLLpjPJ9ovOmYNhumg0Q$dCExGLPsc8cJbnEPm0lYyLj2BF0RoIIoWyE_pXBiU1w','student',1,1,'2026-11-05T00:00:00+00:00'),
('10000000-0000-4000-8000-000000000004','student4','student4@iisertirupati.ac.in','pbkdf2_sha256$100000$oDSLLpjPJ9ovOmYNhumg0Q$dCExGLPsc8cJbnEPm0lYyLj2BF0RoIIoWyE_pXBiU1w','student',1,1,'2026-11-05T00:00:00+00:00');

INSERT OR IGNORE INTO user_profiles (user_id, full_name, display_name, bio, program, academic_year, department, status_text)
VALUES
('10000000-0000-4000-8000-000000000001','Arjun Sharma','Arjun Sharma','3rd Year BS-MS Physics student.','BS-MS','3rd Year','Physics','Testing NEXUS beta features'),
('10000000-0000-4000-8000-000000000002','Student 2','Student 2','NEXUS beta test student account.','BS-MS','3rd Year','General Sciences','Trying NEXUS beta features'),
('10000000-0000-4000-8000-000000000003','Student 3','Student 3','NEXUS beta test student account.','BS-MS','3rd Year','General Sciences','Trying NEXUS beta features'),
('10000000-0000-4000-8000-000000000004','Student 4','Student 4','NEXUS beta test student account.','BS-MS','3rd Year','General Sciences','Trying NEXUS beta features');
