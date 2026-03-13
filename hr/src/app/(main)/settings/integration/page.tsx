'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, Loader2, Send, CheckCircle, XCircle, Calendar, CalendarDays, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ADMIN_ROLES = ["SYSTEM_ADMIN", "COMPANY_ADMIN"];

const PLATFORMS = [
  { value: 'slack', label: 'Slack' },
  { value: 'kakaowork', label: 'Kakao Work' },
  { value: 'teams', label: 'Microsoft Teams' },
  { value: 'custom', label: 'Custom (JSON)' },
];

const EVENTS = [
  { value: 'LEAVE_REQUEST', label: '휴가 신청', enabled: true },
  { value: 'LEAVE_APPROVED', label: '휴가 승인', enabled: true },
  { value: 'LEAVE_REJECTED', label: '휴가 반려', enabled: true },
  { value: 'DAILY_LEAVE_SUMMARY', label: '오늘의 휴무 현황', enabled: true },
  { value: 'WEEKLY_LEAVE_SUMMARY', label: '이번 주 휴무 현황', enabled: true },
  { value: 'OVERTIME_REQUEST', label: '연장근무 신청 (준비중)', enabled: false },
  { value: 'ATTENDANCE_LATE', label: '지각 알림 (준비중)', enabled: false },
];

export default function IntegrationPage() {
  const router = useRouter();
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingDaily, setSendingDaily] = useState(false);
  const [sendingWeekly, setSendingWeekly] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState('slack');
  const [events, setEvents] = useState<string[]>([]);

  // Schedule settings
  const [dailyScheduleEnabled, setDailyScheduleEnabled] = useState(false);
  const [dailyTime, setDailyTime] = useState('09:00');
  const [weeklyScheduleEnabled, setWeeklyScheduleEnabled] = useState(false);
  const [weeklyDay, setWeeklyDay] = useState(1);
  const [weeklyTime, setWeeklyTime] = useState('09:00');

  useEffect(() => {
    fetch("/api/auth/me").then(r => { if (r.status === 401) { window.location.href = '/login'; return null; } return r.ok ? r.json() : null; }).then(d => {
      if (d?.user?.role) {
        if (!ADMIN_ROLES.includes(d.user.role)) {
          router.replace('/dashboard');
          return;
        }
      }
      setRoleLoaded(true);
      loadSettings();
    }).catch(() => setRoleLoaded(true));
  }, [router]);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings/webhooks');
      if (res.ok) {
        const data = await res.json();
        const s = data.settings || {};
        setEnabled(s.webhook_enabled === 'true');
        setUrl(s.webhook_url || '');
        setPlatform(s.webhook_platform || 'slack');
        try {
          setEvents(JSON.parse(s.webhook_events || '[]'));
        } catch {
          setEvents([]);
        }
        // Schedule settings
        setDailyScheduleEnabled(s.schedule_daily_enabled === 'true');
        setDailyTime(s.schedule_daily_time || '09:00');
        setWeeklyScheduleEnabled(s.schedule_weekly_enabled === 'true');
        setWeeklyDay(parseInt(s.schedule_weekly_day || '1', 10));
        setWeeklyTime(s.schedule_weekly_time || '09:00');
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/settings/webhooks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled, url, platform, events,
          schedule: {
            dailyEnabled: dailyScheduleEnabled,
            dailyTime,
            weeklyEnabled: weeklyScheduleEnabled,
            weeklyDay,
            weeklyTime,
          },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('저장되었습니다.');
        setMessageType('success');
      } else {
        setMessage(data.message || '저장 실패');
        setMessageType('error');
      }
    } catch {
      setMessage('서버 오류');
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage('');
    try {
      const res = await fetch('/api/settings/webhooks', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setMessage('테스트 메시지가 전송되었습니다.');
        setMessageType('success');
      } else {
        setMessage(data.message || '전송 실패');
        setMessageType('error');
      }
    } catch {
      setMessage('서버 오류');
      setMessageType('error');
    } finally {
      setTesting(false);
    }
  };

  const handleSendSummary = async (type: 'daily' | 'weekly') => {
    const setter = type === 'daily' ? setSendingDaily : setSendingWeekly;
    setter(true);
    setMessage('');
    try {
      const res = await fetch('/api/webhooks/leave-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setMessageType('success');
      } else {
        setMessage(data.message || '전송 실패');
        setMessageType('error');
      }
    } catch {
      setMessage('서버 오류');
      setMessageType('error');
    } finally {
      setter(false);
    }
  };

  const toggleEvent = (ev: string) => {
    setEvents(prev =>
      prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]
    );
  };

  if (!roleLoaded || loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        불러오는 중...
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link2 className="w-7 h-7 text-slate-600" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">외부서비스 연동</h1>
          <p className="text-sm text-gray-500 mt-0.5">웹훅을 통해 메신저 알림을 설정합니다.</p>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
          messageType === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {messageType === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {message}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">웹훅 메신저 알림</CardTitle>
              <CardDescription>
                Slack, Kakao Work, Teams 등의 메신저로 HR 이벤트 알림을 전송합니다.
              </CardDescription>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Platform */}
          <div className="space-y-2">
            <Label>플랫폼</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PLATFORMS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPlatform(p.value)}
                  className={`px-3 py-2 text-sm rounded-lg border transition ${
                    platform === p.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Webhook URL */}
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={
                platform === 'slack'
                  ? 'https://hooks.slack.com/services/...'
                  : platform === 'teams'
                  ? 'https://outlook.office.com/webhook/...'
                  : 'https://...'
              }
            />
            <p className="text-xs text-gray-400">
              {platform === 'slack' && 'Slack 앱 → Incoming Webhooks에서 URL을 복사하세요.'}
              {platform === 'kakaowork' && 'Kakao Work → 봇 관리에서 Webhook URL을 복사하세요.'}
              {platform === 'teams' && 'Teams 채널 → 커넥터에서 Incoming Webhook URL을 복사하세요.'}
              {platform === 'custom' && 'JSON POST 요청을 받을 수 있는 URL을 입력하세요.'}
            </p>
          </div>

          {/* Events */}
          <div className="space-y-2">
            <Label>알림 이벤트</Label>
            <div className="space-y-2">
              {EVENTS.map(ev => (
                <label key={ev.value} className={`flex items-center gap-3 ${ev.enabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                  <input
                    type="checkbox"
                    checked={events.includes(ev.value)}
                    onChange={() => ev.enabled && toggleEvent(ev.value)}
                    disabled={!ev.enabled}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{ev.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : '설정 저장'}
            </Button>
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || !url}
              className="gap-1.5"
            >
              <Send className="w-4 h-4" />
              {testing ? '전송 중...' : '테스트 발송'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Leave Summary Schedule & Manual Send */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-600" />
            <div>
              <CardTitle className="text-lg">휴무 현황 자동 전송</CardTitle>
              <CardDescription>
                설정한 시간에 자동으로 휴무 인원 목록을 메신저로 전송합니다.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Daily Schedule */}
          <div className="p-4 rounded-lg border border-gray-100 bg-gray-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-800">매일 휴무 현황</span>
                <p className="text-xs text-gray-500">매일 지정 시간에 오늘의 휴무자를 전송합니다.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={dailyScheduleEnabled}
                  onChange={(e) => setDailyScheduleEnabled(e.target.checked)}
                  className="sr-only peer"
                  aria-label="매일 휴무 현황 자동 전송"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            {dailyScheduleEnabled && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">전송 시간</span>
                <input
                  type="time"
                  value={dailyTime}
                  onChange={(e) => setDailyTime(e.target.value)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
          </div>

          {/* Weekly Schedule */}
          <div className="p-4 rounded-lg border border-gray-100 bg-gray-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-800">주간 휴무 현황</span>
                <p className="text-xs text-gray-500">매주 지정 요일/시간에 이번 주 휴무자를 전송합니다.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={weeklyScheduleEnabled}
                  onChange={(e) => setWeeklyScheduleEnabled(e.target.checked)}
                  className="sr-only peer"
                  aria-label="주간 휴무 현황 자동 전송"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            {weeklyScheduleEnabled && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">매주</span>
                <select
                  value={weeklyDay}
                  onChange={(e) => setWeeklyDay(parseInt(e.target.value, 10))}
                  className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={1}>월요일</option>
                  <option value={2}>화요일</option>
                  <option value={3}>수요일</option>
                  <option value={4}>목요일</option>
                  <option value={5}>금요일</option>
                  <option value={6}>토요일</option>
                  <option value={0}>일요일</option>
                </select>
                <input
                  type="time"
                  value={weeklyTime}
                  onChange={(e) => setWeeklyTime(e.target.value)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400">
            * 자동 전송은 위 설정 저장 후 적용됩니다. 이벤트 목록에서 해당 항목도 체크해야 합니다.
          </p>

          {/* Manual Send */}
          <div className="pt-3 border-t border-gray-100">
            <Label className="text-sm text-gray-600 mb-2 block">즉시 전송</Label>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => handleSendSummary('daily')}
                disabled={sendingDaily || !enabled || !url}
                className="gap-2"
              >
                <Calendar className="w-4 h-4" />
                {sendingDaily ? '전송 중...' : '오늘 휴무 현황 전송'}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSendSummary('weekly')}
                disabled={sendingWeekly || !enabled || !url}
                className="gap-2"
              >
                <CalendarDays className="w-4 h-4" />
                {sendingWeekly ? '전송 중...' : '이번 주 휴무 현황 전송'}
              </Button>
            </div>
          </div>

          {!enabled && (
            <p className="text-xs text-amber-600 mt-2">웹훅을 활성화하고 설정을 저장한 후 사용할 수 있습니다.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
