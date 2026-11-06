const API_BASE = '/api/v1';

export interface TokenData {
  access_token: string;
  refresh_token: string;
  user_id: string;
  username: string;
  role: string;
}

export interface UserSummary {
  id: string;
  username: string;
  email: string;
  role: string;
  full_name?: string;
  display_name?: string | null;
  bio?: string;
  program?: string;
  academic_year?: string;
  department?: string;
  status_text?: string;
  avatar_file_id?: string;
  banner_file_id?: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  accent_color?: string;
}

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('nexus_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('nexus_token', token);
    } else {
      localStorage.removeItem('nexus_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Request failed');
    }

    // Return empty for 204 or void
    if (res.status === 204) return null;
    return res.json();
  }

  // Auth
  async register(data: any): Promise<TokenData> {
    const res = await this.request('/auth/register', { method: 'POST', body: JSON.stringify(data) });
    this.setToken(res.access_token);
    return res;
  }

  async login(data: any): Promise<TokenData> {
    const res = await this.request('/auth/login', { method: 'POST', body: JSON.stringify(data) });
    this.setToken(res.access_token);
    return res;
  }

  async firebaseSession(idToken: string, profile?: { username: string; display_name: string }): Promise<TokenData | { profile_required: true; email: string }> {
    const response = await this.request('/auth/firebase', { method: 'POST', body: JSON.stringify({ id_token: idToken, ...profile }) });
    if (!response.profile_required) this.setToken(response.access_token);
    return response;
  }

  async adminListGroups(): Promise<any[]> { return this.request('/admin/groups'); }
  async adminDeleteGroup(groupId: string): Promise<void> { return this.request(`/admin/groups/${encodeURIComponent(groupId)}`, { method: 'DELETE' }); }
  async adminListMessages(query = ''): Promise<any[]> { return this.request(`/admin/messages?q=${encodeURIComponent(query)}`); }
  async adminDeleteMessage(messageId: string): Promise<void> { return this.request(`/admin/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' }); }

  async requestPasswordReset(email: string): Promise<any> {
    return this.request('/auth/request-password-reset', { method: 'POST', body: JSON.stringify({ email }) });
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' }).catch(() => {});
    this.setToken(null);
  }

  async getMe(): Promise<UserSummary> {
    return this.request('/auth/me');
  }

  async getDemoAccounts(): Promise<any[]> {
    return this.request('/auth/demo-accounts');
  }

  // Users & Profiles
  async getProfile(username: string): Promise<any> {
    return this.request(`/users/profile/${username}`);
  }

  async updateProfile(data: any): Promise<any> {
    return this.request('/users/profile', { method: 'PUT', body: JSON.stringify(data) });
  }

  async uploadAvatar(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/users/profile/avatar', { method: 'POST', body: formData });
  }

  async deleteAvatar(): Promise<any> {
    return this.request('/users/profile/avatar', { method: 'DELETE' });
  }

  async uploadBanner(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/users/profile/banner', { method: 'POST', body: formData });
  }

  async deleteBanner(): Promise<any> {
    return this.request('/users/profile/banner', { method: 'DELETE' });
  }

  async updateSettings(data: any): Promise<any> {
    return this.request('/users/settings', { method: 'PUT', body: JSON.stringify(data) });
  }

  // Friends
  async listFriends(): Promise<any[]> {
    return this.request('/friends');
  }

  async listFriendRequests(): Promise<any[]> {
    return this.request('/friends/requests');
  }

  async listSentFriendRequests(): Promise<any[]> { return this.request('/friends/requests/sent'); }

  async sendFriendRequest(userId: string): Promise<any> {
    return this.request(`/friends/request/${userId}`, { method: 'POST' });
  }

  async acceptFriendRequest(requestId: string): Promise<any> {
    return this.request(`/friends/accept/${requestId}`, { method: 'POST' });
  }

  async rejectFriendRequest(requestId: string): Promise<any> { return this.request(`/friends/reject/${requestId}`, { method: 'POST' }); }
  async cancelFriendRequest(requestId: string): Promise<any> { return this.request(`/friends/requests/${requestId}`, { method: 'DELETE' }); }
  async getPublicProfile(username: string): Promise<any> { return this.request(`/users/profile/${encodeURIComponent(username)}`); }

  async searchUsers(query: string): Promise<any[]> {
    return this.request(`/friends/search?q=${encodeURIComponent(query.replace(/^@+/, '').trim())}`);
  }

  // Messaging
  async listConversations(): Promise<any[]> {
    return this.request('/messages/conversations');
  }

  async createConversation(data: any): Promise<any> {
    return this.request('/messages/conversations', { method: 'POST', body: JSON.stringify(data) });
  }

  async openDirectMessage(userId: string): Promise<any> { return this.request(`/messages/direct/${encodeURIComponent(userId)}`, { method: 'POST' }); }
  async setTyping(conversationId: string, isTyping: boolean): Promise<any> { return this.request(`/messages/conversations/${conversationId}/typing`, { method: 'POST', body: JSON.stringify({ is_typing: isTyping }) }); }
  async getTyping(conversationId: string): Promise<any[]> { return this.request(`/messages/conversations/${conversationId}/typing`); }

  async listCampusGroups(): Promise<any[]> { return this.request('/groups'); }
  async importCampusGroups(groups: any[]): Promise<any> { return this.request('/groups/import', { method: 'POST', body: JSON.stringify({ groups }) }); }
  async createCampusGroup(group: any): Promise<any> { return this.request('/groups', { method: 'POST', body: JSON.stringify(group) }); }
  async joinCampusGroup(groupId: string): Promise<any> { return this.request(`/groups/${groupId}/join`, { method: 'POST' }); }
  async updateCampusGroup(groupId: string, group: any): Promise<any> { return this.request(`/groups/${groupId}`, { method: 'PATCH', body: JSON.stringify(group) }); }
  async deleteCampusGroup(groupId: string): Promise<any> { return this.request(`/groups/${groupId}`, { method: 'DELETE' }); }
  async addCampusGroupChannel(groupId: string, name: string): Promise<any> { return this.request(`/groups/${groupId}/channels`, { method: 'POST', body: JSON.stringify({ name }) }); }
  async deleteCampusGroupChannel(groupId: string, channelId: string): Promise<any> { return this.request(`/groups/${groupId}/channels/${channelId}`, { method: 'DELETE' }); }
  async listCampusGroupMessages(groupId: string, channelId: string): Promise<any[]> { return this.request(`/groups/${groupId}/channels/${channelId}/messages`); }
  async sendCampusGroupMessage(groupId: string, channelId: string, content: string, replyToId?: string): Promise<any> { return this.request(`/groups/${groupId}/channels/${channelId}/messages`, { method: 'POST', body: JSON.stringify({ content, reply_to_id: replyToId || null }) }); }
  async clearCampusGroupMessages(groupId: string, channelId: string): Promise<any> { return this.request(`/groups/${groupId}/channels/${channelId}/messages`, { method: 'DELETE' }); }
  async deleteCampusGroupMessage(groupId: string, messageId: string): Promise<any> { return this.request(`/groups/${groupId}/messages/${messageId}`, { method: 'DELETE' }); }
  async toggleCampusGroupReaction(groupId: string, messageId: string, emoji: string): Promise<any> { return this.request(`/groups/${groupId}/messages/${messageId}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) }); }
  async setCampusGroupTyping(groupId: string, channelId: string, isTyping: boolean): Promise<any> { return this.request(`/groups/${groupId}/channels/${channelId}/typing`, { method: 'POST', body: JSON.stringify({ is_typing: isTyping }) }); }
  async getCampusGroupTyping(groupId: string, channelId: string): Promise<any[]> { return this.request(`/groups/${groupId}/channels/${channelId}/typing`); }

  async getMessages(convId: string): Promise<any[]> {
    return this.request(`/messages/conversations/${convId}/messages`);
  }

  async clearConversationHistory(convId: string): Promise<{ message: string; cleared_count: number }> {
    return this.request(`/messages/conversations/${convId}/messages`, { method: 'DELETE' });
  }

  async sendMessage(convId: string, data: any): Promise<any> {
    return this.request(`/messages/conversations/${convId}/messages`, { method: 'POST', body: JSON.stringify(data) });
  }

  async editMessage(messageId: string, content: string): Promise<any> {
    return this.request(`/messages/messages/${messageId}`, { method: 'PUT', body: JSON.stringify({ content }) });
  }

  async deleteMessage(messageId: string): Promise<any> {
    return this.request(`/messages/messages/${messageId}`, { method: 'DELETE' });
  }

  async toggleReaction(messageId: string, emoji: string): Promise<any> {
    return this.request(`/messages/messages/${messageId}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) });
  }

  async toggleMessagePin(messageId: string): Promise<{ message: string; is_pinned: boolean }> {
    return this.request(`/messages/messages/${messageId}/pin`, { method: 'POST' });
  }

  // AI Orchestration
  async listAITools(): Promise<any[]> {
    return this.request('/ai/tools');
  }

  async listAIConversations(): Promise<any[]> {
    return this.request('/ai/conversations');
  }

  async createAIConversation(title: string): Promise<any> {
    return this.request('/ai/conversations', { method: 'POST', body: JSON.stringify({ title }) });
  }

  async createAIThread(convId: string, title: string): Promise<any> {
    return this.request(`/ai/conversations/${convId}/threads`, { method: 'POST', body: JSON.stringify({ title }) });
  }

  async deleteAIConversation(convId: string): Promise<any> {
    return this.request(`/ai/conversations/${convId}`, { method: 'DELETE' });
  }

  async getAIMessages(convId: string, offset = 0): Promise<any> {
    return this.request(`/ai/conversations/${convId}/messages?offset=${offset}`);
  }

  async confirmAITool(convId: string, executionId: string, approved: boolean): Promise<any> {
    return this.request(`/ai/conversations/${convId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ execution_id: executionId, approved }),
    });
  }

  async cancelAI(convId: string): Promise<any> {
    return this.request(`/ai/conversations/${convId}/cancel`, { method: 'POST' });
  }

  // Academics & Repository
  async listCourses(): Promise<any[]> {
    return this.request('/academics/courses');
  }

  async listResources(query?: string, category?: string): Promise<any[]> {
    let url = '/academics/resources?';
    if (query) url += `query=${encodeURIComponent(query)}&`;
    if (category) url += `category=${encodeURIComponent(category)}&`;
    return this.request(url);
  }

  async uploadResource(formData: FormData): Promise<any> {
    return this.request('/academics/resources', { method: 'POST', body: formData });
  }

  // Forums
  async listForumPosts(category?: string, query?: string): Promise<any[]> {
    let url = '/forums/posts?';
    if (category) url += `category=${encodeURIComponent(category)}&`;
    if (query) url += `query=${encodeURIComponent(query)}&`;
    return this.request(url);
  }

  async createForumPost(data: any): Promise<any> {
    return this.request('/forums/posts', { method: 'POST', body: JSON.stringify(data) });
  }

  async getForumPostDetails(postId: string): Promise<any> {
    return this.request(`/forums/posts/${postId}`);
  }

  async addForumComment(postId: string, contentLatex: string, parentCommentId?: string): Promise<any> {
    return this.request(`/forums/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content_latex: contentLatex, parent_comment_id: parentCommentId }),
    });
  }

  async voteForumPost(postId: string, voteType: number): Promise<any> {
    return this.request(`/forums/posts/${postId}/vote`, { method: 'POST', body: JSON.stringify({ vote_type: voteType }) });
  }

  // Campus Hub
  async getCampusPulse(): Promise<any[]> {
    return this.request('/campus/pulse');
  }

  async postCampusPulse(content: string, category: string = 'general'): Promise<any> {
    return this.request('/campus/pulse', { method: 'POST', body: JSON.stringify({ content, category }) });
  }

  async getDailyQuestion(): Promise<any> {
    return this.request('/campus/daily-question');
  }

  async createDailyQuestionProposal(data: {
    category: string;
    question_latex: string;
    options: string[];
    correct_option: number;
    explanation_latex: string;
    template_notes: string;
    animation_notes: string;
  }): Promise<any> {
    return this.request('/campus/daily-question-proposals', { method: 'POST', body: JSON.stringify(data) });
  }

  async listDailyQuestionProposals(): Promise<any[]> {
    return this.request('/campus/daily-question-proposals');
  }

  async listDailyQuestions(): Promise<any[]> {
    return this.request('/campus/daily-questions');
  }

  async uploadDailyQuestionPdf(file: File): Promise<any> {
    const body = new FormData();
    body.append('file', file);
    return this.request('/files/daily-question-attachment', { method: 'POST', body });
  }

  async downloadDailyQuestionAttachment(questionId: string, answerId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/campus/daily-questions/${questionId}/answers/${answerId}/attachment`, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Could not download this PDF' }));
      throw new Error(error.detail || 'Could not download this PDF');
    }
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = 'daily-question-answer.pdf';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  }

  async submitDailyQuestionAnswer(questionId: string, answerLatex: string, selectedOption: number, attachmentFileId?: string): Promise<any> {
    return this.request(`/campus/daily-questions/${questionId}/answers`, { method: 'POST', body: JSON.stringify({ answer_latex: answerLatex, selected_option: selectedOption, attachment_file_id: attachmentFileId || null }) });
  }

  async listDailyQuestionAnswers(questionId: string): Promise<any[]> {
    return this.request(`/campus/daily-questions/${questionId}/answers`);
  }

  async addDailyQuestionAnswerComment(questionId: string, answerId: string, content: string, parentCommentId?: string): Promise<any> {
    return this.request(`/campus/daily-questions/${questionId}/answers/${answerId}/comments`, {
      method: 'POST', body: JSON.stringify({ content, parent_comment_id: parentCommentId }),
    });
  }

  async listCalendarEvents(): Promise<any[]> {
    return this.request('/campus/calendar');
  }

  async listCampusEvents(): Promise<any[]> {
    return this.request('/campus/events');
  }

  async listTasks(): Promise<any[]> {
    return this.request('/campus/tasks');
  }

  async createTask(data: any): Promise<any> {
    return this.request('/campus/tasks', { method: 'POST', body: JSON.stringify(data) });
  }

  async toggleTask(taskId: string): Promise<any> {
    return this.request(`/campus/tasks/${taskId}/toggle`, { method: 'PUT' });
  }

  async listNotifications(): Promise<any[]> {
    return this.request('/campus/notifications');
  }
}

export const api = new ApiService();
