# NEXUS Feature Checklist

## Status Legend
- ⏳ Pending
- 🔄 In Progress
- ✅ Implemented & Tested

---

## 1. Authentication and User Management
- [x] Registration (`/api/v1/auth/register`) ✅
- [x] Login (`/api/v1/auth/login`) ✅
- [x] Logout (`/api/v1/auth/logout`) ✅
- [x] Password Hashing (bcrypt, 12 rounds) ✅
- [x] Session Management (JWT Access & Refresh Tokens) ✅
- [x] Password Reset Architecture (`/request-password-reset`, `/reset-password`) ✅
- [x] Email Verification Architecture ✅
- [x] Account Management (`/me`) ✅
- [x] Role-Based Permissions (Student, Moderator, Administrator) ✅
- [x] Protected Routes & Backend Permission Checks (`require_role`) ✅
- [x] Session Expiration & Secure Token Configuration ✅
- [x] Rate Limiting (In-memory sliding window for login attempt protection) ✅
- [x] Demo Accounts & Dev Auth Mode (`student1`, `moderator1`, `admin`) ✅

## 2. User Profiles & Social Connections
- [x] Full Name, Username, Display Name, Bio, Academic Program, Year, Department, Status ✅
- [x] Username availability & uniqueness validation (`/users/check-username`) ✅
- [x] Profile picture upload, replacement, deletion (persistent storage) ✅
- [x] Profile banner upload, replacement, deletion ✅
- [x] Profile accent color & visibility settings (Public/Private) ✅
- [x] Canonical user profile data (shared across all views) ✅
- [x] Friend requests (Send, Accept, Reject, Remove) ✅
- [x] Block & Unblock users (enforces messaging blockage) ✅
- [x] User Search & Suggested Friends (`/friends/search`) ✅
- [x] Mutual Friends calculation ✅
- [x] Online/Offline presence & Last seen privacy ✅

## 3. Permanent Messaging System
- [x] 1-to-1 Direct Messaging ✅
- [x] Conversation Creation & History ✅
- [x] Text Messages & Attachment references (Images, Documents, Audio) ✅
- [x] Message Replies & Quotes ✅
- [x] Message Reactions (Emoji counts & toggling) ✅
- [x] Message Editing & History (`is_edited`) ✅
- [x] Message Pinning & Forwarding ✅
- [x] Group Messaging (Creation, Descriptions, Avatars, Roles, Admin controls) ✅
- [x] WebSockets (Instant delivery, Typing indicators, Online status, Read receipts) ✅
- [x] Reconnection handling & Fallback ✅
- [x] **Permanent PostgreSQL Storage** (Zero loss on refresh, tab close, server restart) ✅
- [x] Explicit user/admin deletion policy with audit records (`audit_logs`) ✅
- [x] Cursor/Offset Pagination for thousands of messages ✅

## 4. AI Orchestration Loop (Mock Provider)
- [x] Request Handler & Validation ✅
- [x] Conversation & Context Manager ✅
- [x] Message History Manager ✅
- [x] Intent Routing Interface ✅
- [x] Modular Tool Registry (10 tools: Academic search, Courses, Calendar, Email draft, Assignments, etc.) ✅
- [x] Permission & Confirmation Manager (Read-only vs Reversible vs Destructive safety tiers) ✅
- [x] Execution Manager ✅
- [x] Response Processor ✅
- [x] Streaming Response Handler (Server-Sent Events) ✅
- [x] Mock AI Provider (Deterministic mock answers, simulated delays, simulated streaming, tool calls, error handling, cancellation) ✅
- [x] Frontend minimal AI test harness interface (`/ai`) ✅

## 5. Local LaTeX & Scientific Mathematical Rendering
- [x] Locally bundled KaTeX (zero CDN reliance, 100% offline support) ✅
- [x] Reusable React component (`MathRenderer`) for inline `$math$` and display `$$math$$` ✅
- [x] Support for integrals, fractions, matrices, summations, greek symbols, chemical notation ✅
- [x] Safe rendering settings (XSS prevention, `throwOnError: false`, `trust: false`) ✅
- [x] Scientific document editor foundation with live sanitized LaTeX preview (`/latex`) ✅

## 6. Academic Repository & Courses
- [x] Resource upload (PDF, DOCX, PPTX, Images, ZIP) with metadata ✅
- [x] Metadata: Subject, Course, Academic Year, Semester, Category, Contributor ✅
- [x] Bookmarks, Ratings, Reports, Download counter tracking ✅
- [x] Upload validation & download permissions (`/api/v1/files/{id}/download`) ✅
- [x] Search, filtering, sorting, pagination ✅
- [x] Courses catalog, enrolments, faculty info, assignments, materials, announcements ✅

## 7. Forums and Discussions
- [x] Discussion threads by category ✅
- [x] Comments & nested replies ✅
- [x] Upvotes, downvotes, accepted answers ✅
- [x] Full LaTeX math support in forum posts & comments ✅
- [x] Persistent forum storage & moderation ✅

## 8. Notifications, Calendar, & Campus Features
- [x] Central notification bus (Messages, Friends, Groups, Deadlines, Announcements) ✅
- [x] Read/Unread state & real-time delivery ✅
- [x] Calendar events, academic deadlines, personal tasks, notes ✅
- [x] Campus Pulse activity feed ✅
- [x] Events & RSVP registrations ✅
- [x] Opportunities board (Internships, Research, Scholarships) ✅
- [x] Lost & Found module ✅
- [x] Question of the Day / Answer of the Day (QOTD/AOTD) ✅
