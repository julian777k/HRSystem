'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, Calendar, MessageSquare, Info, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

const ADMIN_ROLES = ["SYSTEM_ADMIN", "COMPANY_ADMIN"];

export default function IntegrationPage() {
  const router = useRouter();
  const [roleLoaded, setRoleLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(r => { if (r.status === 401) { window.location.href = '/login'; return null; } return r.ok ? r.json() : null; }).then(d => {
      if (d?.user?.role) {
        if (!ADMIN_ROLES.includes(d.user.role)) {
          router.replace('/dashboard');
          return;
        }
      }
      setRoleLoaded(true);
    }).catch(() => setRoleLoaded(true));
  }, [router]);

  if (!roleLoaded) {
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
          <p className="text-sm text-gray-500 mt-0.5">외부 서비스를 연동하여 업무 효율을 높입니다.</p>
        </div>
      </div>

      <Alert className="mb-6">
        <Info className="w-4 h-4" />
        <AlertDescription>
          외부 서비스 연동은 추후 업데이트에서 지원될 예정입니다.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Google Calendar */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <CardTitle className="text-lg">Google Calendar</CardTitle>
                  <CardDescription>
                    휴가/근무 일정을 Google Calendar와 동기화합니다.
                  </CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0">미연동</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-lg p-4 mb-4">
              <p className="text-sm text-muted-foreground">
                Phase 4에서 구현 예정입니다. Google Calendar API를 통해 휴가 승인 시
                자동으로 캘린더에 일정이 등록됩니다.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Client ID</Label>
                <Input
                  disabled
                  placeholder="Google OAuth Client ID"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">API Key</Label>
                <Input
                  disabled
                  placeholder="Google API Key"
                />
              </div>
            </div>

            <div className="mt-4">
              <Button disabled className="w-full sm:w-auto" title="추후 업데이트에서 지원 예정">
                연동하기
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Slack */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-purple-600 shrink-0" />
                <div className="min-w-0">
                  <CardTitle className="text-lg">Slack</CardTitle>
                  <CardDescription>
                    결재 알림, 휴가 알림 등을 Slack으로 전송합니다.
                  </CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0">미연동</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-lg p-4 mb-4">
              <p className="text-sm text-muted-foreground">
                추후 업데이트에서 구현 예정입니다. Slack Webhook을 통해
                결재 요청, 승인/반려 알림이 자동 전송됩니다.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Webhook URL</Label>
                <Input
                  disabled
                  placeholder="Slack Webhook URL"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">채널</Label>
                <Input
                  disabled
                  placeholder="#hr-notifications"
                />
              </div>
            </div>

            <div className="mt-4">
              <Button disabled className="w-full sm:w-auto" title="추후 업데이트에서 지원 예정">
                연동하기
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
