-- seed for local dev (run after migrate)
INSERT INTO users (email, display_name, password_hash, is_verified) VALUES
 ('sender@test.com','Test Sender','$2a$12$dummyhashfortestsonlyxxxxxxxxxxxxxxxxxxxxxxxxxxxx', TRUE)
ON CONFLICT DO NOTHING;
