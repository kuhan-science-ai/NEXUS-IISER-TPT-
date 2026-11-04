# NEXUS API Documentation

All REST APIs are versioned under `/api/v1`. Interactive OpenAPI/Swagger documentation is available at `/docs` and ReDoc at `/redoc`.

## Summary of Core API Endpoints

### 1. Authentication (`/api/v1/auth`)
- `POST /register`: Register a new user account.
- `POST /login`: Authenticate and receive JWT access/refresh tokens.
- `POST /logout`: Invalidate session.
- `GET /me`: Get current authenticated user details.
- `POST /demo-accounts`: Seed or obtain instant dev demo accounts (Student, Moderator, Admin).
- `POST /request-password-reset`: Request reset token.
- `POST /reset-password`: Complete password reset.

### 2. Users & Profiles (`/api/v1/users`)
- `GET /check-username?username=...`: Check username availability.
- `GET /profile/{username}`: Get canonical user profile.
- `PUT /profile`: Update current user's profile info & settings.
- `POST /profile/avatar`: Upload and set avatar image.
- `DELETE /profile/avatar`: Remove avatar image.
- `POST /profile/banner`: Upload and set banner image.
- `DELETE /profile/banner`: Remove banner image.

### 3. Friends & Social (`/api/v1/friends`)
- `GET /`: List confirmed friends.
- `GET /requests`: List incoming and outgoing friend requests.
- `POST /request/{user_id}`: Send a friend request.
- `POST /accept/{request_id}`: Accept friend request.
- `POST /reject/{request_id}`: Reject friend request.
- `DELETE /{user_id}`: Remove friend.
- `POST /block/{user_id}`: Block user.
- `DELETE /block/{user_id}`: Unblock user.
- `GET /search?q=...`: Search users by name/username.
- `GET /mutual/{user_id}`: Get mutual friends.

### 4. Messaging (`/api/v1/messages`)
- `GET /conversations`: List user conversations with last message & unread badge.
- `POST /conversations`: Create 1-to-1 or group conversation.
- `GET /conversations/{conv_id}/messages`: Fetch paginated message history.
- `POST /conversations/{conv_id}/messages`: Send message with optional attachments/replies.
- `PUT /messages/{message_id}`: Edit message content.
- `DELETE /messages/{message_id}`: Delete message (user/admin).
- `POST /messages/{message_id}/reactions`: Add or remove reaction.
- `POST /messages/{message_id}/pin`: Pin or unpin message.
- `POST /conversations/{conv_id}/read`: Mark conversation as read up to message ID.

### 5. WebSocket (`/ws/nexus?token=...`)
- Real-time bidirectional connection.
- Events handled: `message.send`, `message.delivered`, `typing.start`, `typing.stop`, `presence.update`, `notification.new`.

### 6. AI Orchestration (`/api/v1/ai`)
- `POST /conversations`: Start or fetch AI session.
- `POST /conversations/{conv_id}/chat`: Send user prompt, triggers request validation, context building, intent routing, tool determination, mock execution, and streaming response.
- `POST /conversations/{conv_id}/confirm`: Confirm or reject pending destructive tool execution.
- `POST /conversations/{conv_id}/cancel`: Cancel in-flight AI processing.
- `GET /tools`: List available tools in registry with parameter specs and safety tiers.

### 7. Files & Storage (`/api/v1/files`)
- `POST /upload`: Upload file (avatar, banner, PDF, doc, audio). Returns file metadata.
- `GET /{file_id}/download`: Download file with permission validation.
- `GET /{file_id}/info`: Get file metadata.
- `POST /daily-question-attachment`: Upload a PDF for a daily-question answer (PDF only, 10 MB maximum); the answer API accepts its returned `file_id` only for the same uploader.

### 8. Academic Repository & Courses (`/api/v1/academics`)
- `GET /courses`: List courses.
- `POST /courses/{course_id}/enroll`: Enroll in course.
- `GET /resources`: Search and filter academic resources.
- `POST /resources`: Upload academic resource metadata and file.
- `POST /resources/{resource_id}/bookmark`: Bookmark resource.
- `POST /resources/{resource_id}/rate`: Rate resource.

### 9. Forums (`/api/v1/forums`)
- `GET /posts`: List posts with category, search, and sorting.
- `POST /posts`: Create forum post (supports LaTeX content).
- `GET /posts/{post_id}`: Get post details and nested comments.
- `POST /posts/{post_id}/comments`: Add comment.
- `POST /posts/{post_id}/vote`: Upvote/downvote post.
- `POST /comments/{comment_id}/accept`: Mark comment as accepted answer.

### 10. Calendar, Notifications & Campus (`/api/v1/campus`)
- `GET /notifications`: List notifications.
- `POST /notifications/{id}/read`: Mark as read.
- `POST /notifications/read-all`: Mark all as read.
- `GET /calendar/events`: List calendar events within date range.
- `POST /calendar/events`: Create calendar event.
- `GET /pulse`: Get Campus Pulse activity feed.
- `GET /events`: List campus events & RSVP.
- `GET /opportunities`: List scholarships, internships, workshops.
- `GET /lost-found`: List lost & found items.
- `GET /daily-question`: Fetch Question of the Day.
- `GET /daily-questions`: List the question archive with official explanations and answer counts.
- `POST /daily-question-proposals`: Submit a pending QOTD proposal with category, LaTeX question, four LaTeX options, correct-option index, worked explanation, template notes, and animation notes. New submissions notify moderators and administrators.
- `GET /daily-question-proposals`: List proposals for moderator/administrator review.
- `POST /daily-questions/{question_id}/answers`: Submit the authenticated user's single immutable answer (`selected_option` 0–3, explanation in `answer_latex`, optional `attachment_file_id`); awards that question's participation points.
- `GET /daily-questions/{question_id}/answers`: List other students' answers and discussion comments after the authenticated user has answered that question; the viewer's own answer is omitted.
- `GET /daily-questions/{question_id}/answers/{answer_id}/attachment`: Download an attached answer PDF after the authenticated user has answered that question.
- `POST /daily-questions/{question_id}/answers/{answer_id}/comments`: Add a discussion comment or nested reply; answer-gated.

