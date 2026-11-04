import React from 'react';
import { UserSummary } from '../services/api';

interface NavigationProps {
  user: UserSummary | null;
  onLogout: () => void;
}

// Inner-page navigation is now handled by SideNav component.
// This top-bar nav is no longer rendered (LandingPage/AuthPage have their own nav).
export const Navigation: React.FC<NavigationProps> = () => null;
