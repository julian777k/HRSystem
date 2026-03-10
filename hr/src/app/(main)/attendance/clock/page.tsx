'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface AttendanceRecord {
  id: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  workHours: number | null;
  overtimeHours: number | null;
  status: string;
}

interface OvertimeRequestInfo {
  id: string;
  startTime: string;
  endTime: string;
  hours: number;
  reason: string;
  overtimeType: string;
}

interface TodayData {
  attendance: AttendanceRecord | null;
  workSettings: {
    workStartTime: string;
    workEndTime: string;
    lunchStartTime: string;
    lunchEndTime: string;
  };
  dailyWorkHours: number;
  approvedOvertime: {
    totalHours: number;
    requests: OvertimeRequestInfo[];
  } | null;
  isWorkday: boolean;
}

const OVERTIME_TYPE_LABEL: Record<string, string> = {
  WEEKDAY_OVERTIME: '평일 연장',
  NIGHT: '야간',
  WEEKEND: '휴일',
  HOLIDAY: '공휴일',
};

export default function AttendanceClockPage() {
  const [todayData, setTodayData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchToday = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance/today');
      if (res.status === 401) { window.location.href = '/login'; return; }
      if (res.ok) {
        const data = await res.json();
        setTodayData(data);
      }
    } catch {
      toast.error('출퇴근 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  const currentDate = new Date();
  const dateDisplay = currentDate.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  if (loading) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Clock className="w-7 h-7 text-indigo-600" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">오늘의 근무</h1>
            <p className="text-sm text-gray-500 mt-0.5">자동 근무 기록 현황을 확인합니다.</p>
          </div>
        </div>
        <div className="max-w-lg mx-auto">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                불러오는 중...
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const ws = todayData?.workSettings;
  const dailyHours = todayData?.dailyWorkHours ?? 8;
  const overtime = todayData?.approvedOvertime;
  const isWorkday = todayData?.isWorkday ?? false;

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <Clock className="w-7 h-7 text-indigo-600" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">오늘의 근무</h1>
          <p className="text-sm text-gray-500 mt-0.5">자동 근무 기록 현황을 확인합니다.</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto space-y-6">
        {/* Unified Today Card */}
        <Card>
          <CardContent className="p-0">
            {/* Date & Status Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900">{dateDisplay}</p>
              {isWorkday ? (
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">근무일</Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">비근무일</Badge>
              )}
            </div>

            {/* Work Hours */}
            {isWorkday && ws ? (
              <>
                <div className="p-4">
                  <div className="flex items-center justify-center gap-6">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">출근</p>
                      <p className="text-2xl font-mono font-bold text-gray-900">
                        {ws.workStartTime}
                      </p>
                    </div>
                    <div className="w-12 h-px bg-gray-300" />
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">퇴근</p>
                      <p className="text-2xl font-mono font-bold text-gray-900">
                        {ws.workEndTime}
                      </p>
                    </div>
                  </div>
                  <p className="text-center text-xs text-gray-400 mt-3">
                    점심 {ws.lunchStartTime}~{ws.lunchEndTime} · 기본 {dailyHours}시간
                  </p>
                </div>

                {/* Overtime section (inside the same card) */}
                {overtime && overtime.totalHours > 0 && (
                  <div className="border-t border-gray-100 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-orange-700">승인된 연장근무</span>
                      <span className="font-bold text-orange-700">+{overtime.totalHours}시간</span>
                    </div>
                    {overtime.requests.map((req) => (
                      <div key={req.id} className="flex items-center justify-between text-sm py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">
                            {req.startTime} ~ {req.endTime}
                          </span>
                          <Badge className="text-xs bg-orange-100 text-orange-800 hover:bg-orange-100">
                            {OVERTIME_TYPE_LABEL[req.overtimeType] || req.overtimeType}
                          </Badge>
                        </div>
                        <span className="font-medium">{req.hours}h</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-gray-100 pt-2 mt-2 text-sm">
                      <span className="text-gray-600">총 근무시간</span>
                      <span className="font-bold text-lg">
                        {dailyHours + overtime.totalHours}시간
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                비근무일에는 근무 기록이 생성되지 않습니다.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overtime request shortcut */}
        <Link href="/attendance/overtime">
          <Button variant="outline" className="w-full h-12 text-sm font-medium">
            <Clock className="w-4 h-4 mr-2" />
            연장근무 신청
            <ArrowRight className="w-4 h-4 ml-auto" />
          </Button>
        </Link>

      </div>
    </div>
  );
}
