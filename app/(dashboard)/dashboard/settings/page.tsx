"use client";

import { useEffect, useState } from 'react';
import { Bell, Lock, Moon, User } from 'lucide-react';
import { ThemeToggle } from '../../../../components/layout/theme-toggle';
import { useDashboardSession } from '../../../../components/layout/dashboard-session';

type SettingsTab = 'profile' | 'appearance' | 'notifications';

export default function SettingsPage() {
  const { user, loading } = useDashboardSession();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [toggles, setToggles] = useState({
    submissions: true,
    rejections: true,
    finance: false,
  });

  useEffect(() => {
    if (!user) return;
    setName(user.full_name || '');
    setEmail(user.email || '');
    setRole(user.role || '');
  }, [user]);

  const handleSave = () => {
    console.log('save clicked');
  };

  if (loading || !user) return null;

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Moon },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ] as const;

  return (
    <div className="intake-shell" style={{ paddingBottom: 40 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>Settings</h1>
        <p className="text-muted" style={{ margin: '8px 0 0', fontSize: 14 }}>
          Manage your account and preferences
        </p>
      </div>

      <div className="settings-layout">
        <nav className="settings-tab-nav" aria-label="Settings navigation">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`settings-tab-nav-item ${isActive ? 'settings-tab-nav-item-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={16} style={{ flexShrink: 0 }} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <section className="settings-card">
          {activeTab === 'profile' && (
            <div style={{ display: 'grid', gap: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                <div className="settings-avatar">{(name || 'U').charAt(0).toUpperCase()}</div>
                <button
                  type="button"
                  className="settings-action-button"
                  style={{
                    padding: '10px 16px',
                    border: '1px solid var(--surface-border)',
                    background: 'var(--card)',
                    color: 'var(--fg)',
                  }}
                >
                  Change photo
                </button>
              </div>

              <div style={{ display: 'grid', gap: 20, borderTop: '1px solid var(--surface-border)', paddingTop: 20 }}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <label className="settings-field-label">Full Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="settings-form-input" />
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  <label className="settings-field-label">Email Address</label>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <input type="email" value={email} readOnly className="settings-form-input" />
                    <Lock size={16} className="text-muted" />
                  </div>
                  <p className="text-muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
                    Locked for security
                  </p>
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  <label className="settings-field-label">Role</label>
                  <input type="text" value={role} readOnly className="settings-form-input" style={{ textTransform: 'capitalize' }} />
                </div>

                <button
                  onClick={handleSave}
                  type="button"
                  className="settings-form-button"
                  style={{
                    padding: '10px 20px',
                    fontSize: 14,
                    fontWeight: 600,
                    width: 'fit-content',
                    background: 'linear-gradient(135deg, var(--primary-strong), var(--accent))',
                    color: '#fff',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)',
                    marginTop: 8,
                  }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div style={{ display: 'grid', gap: 24 }}>
              <div>
                <h3 className="settings-section-title" style={{ marginBottom: 16 }}>
                  Theme
                </h3>
                <div style={{ display: 'grid', gap: 12 }}>
                  <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
                    Switch instantly between the current light and dark dashboard themes.
                  </p>
                  <div style={{ width: 'fit-content' }}>
                    <ThemeToggle />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                { key: 'submissions', label: 'Submission Status', description: 'Get notified when submissions are processed' },
                { key: 'rejections', label: 'Rejection Alerts', description: 'Receive alerts when submissions are rejected' },
                { key: 'finance', label: 'Finance Review', description: 'Stay updated on finance review progress' },
              ].map((notif) => (
                <label key={notif.key} className="settings-notif-item">
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 500, color: 'var(--fg)' }}>
                      {notif.label}
                    </p>
                    <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
                      {notif.description}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={toggles[notif.key as keyof typeof toggles]}
                    onChange={(e) =>
                      setToggles((prev) => ({
                        ...prev,
                        [notif.key]: e.target.checked,
                      }))
                    }
                    style={{ cursor: 'pointer', width: 20, height: 20, marginLeft: 16, accentColor: '#6366f1' }}
                    aria-label={notif.label}
                  />
                </label>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
