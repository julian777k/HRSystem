"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Save,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

interface CompanySettings {
  company_name: string;
  biz_number: string;
  representative: string;
  address: string;
  work_start_time: string;
  work_end_time: string;
  lunch_start_time: string;
  lunch_end_time: string;
  server_url: string;
}

const defaultSettings: CompanySettings = {
  company_name: "",
  biz_number: "",
  representative: "",
  address: "",
  work_start_time: "09:00",
  work_end_time: "18:00",
  lunch_start_time: "12:00",
  lunch_end_time: "13:00",
  server_url: "",
};

const ADMIN_ROLES = ["SYSTEM_ADMIN", "COMPANY_ADMIN"];

export default function CompanySettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<CompanySettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const meRes = await fetch("/api/auth/me");
        if (meRes.status === 401) {
          window.location.href = '/login';
          return;
        }
        if (meRes.ok) {
          const meData = await meRes.json();
          if (!ADMIN_ROLES.includes(meData.user?.role)) {
            router.replace("/dashboard");
            return;
          }
        }

        const res = await fetch("/api/company/settings");
        if (res.ok) {
          const data = await res.json();
          setSettings((prev) => ({ ...prev, ...data.settings }));
        }
      } catch {
        toast.error('설정을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/company/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "회사 정보가 저장되었습니다." });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.message || "저장에 실패했습니다." });
      }
    } catch {
      setMessage({ type: "error", text: "서버에 연결할 수 없습니다." });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof CompanySettings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    if (message) setMessage(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="w-7 h-7 text-slate-600" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">회사 정보 설정</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            회사 기본 정보 및 근무 시간을 설정합니다.
          </p>
        </div>
      </div>

      {message && (
        <Alert
          className={`mb-4 ${message.type === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
        >
          {message.type === "success" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
          <AlertDescription className={message.type === "success" ? "text-green-800" : "text-red-800"}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {/* 기본 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">기본 정보</CardTitle>
            <CardDescription>회사 기본 정보를 입력해주세요.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">회사명</Label>
                <Input
                  id="company_name"
                  value={settings.company_name}
                  onChange={(e) => updateSetting("company_name", e.target.value)}
                  placeholder="주식회사 OO"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="biz_number">사업자번호</Label>
                <Input
                  id="biz_number"
                  value={settings.biz_number}
                  onChange={(e) => updateSetting("biz_number", e.target.value)}
                  placeholder="000-00-00000"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="representative">대표자명</Label>
                <Input
                  id="representative"
                  value={settings.representative}
                  onChange={(e) => updateSetting("representative", e.target.value)}
                  placeholder="홍길동"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="server_url">서버 URL</Label>
                <Input
                  id="server_url"
                  value={settings.server_url}
                  onChange={(e) => updateSetting("server_url", e.target.value)}
                  placeholder="https://hr.company.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">주소</Label>
              <Input
                id="address"
                value={settings.address}
                onChange={(e) => updateSetting("address", e.target.value)}
                placeholder="서울특별시 강남구 ..."
              />
            </div>
          </CardContent>
        </Card>

        {/* 근무 시간 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">근무 시간</CardTitle>
            <CardDescription>기본 근무 시간과 점심시간을 설정합니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="work_start_time">근무 시작</Label>
                <Input
                  id="work_start_time"
                  type="time"
                  value={settings.work_start_time}
                  onChange={(e) => updateSetting("work_start_time", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="work_end_time">근무 종료</Label>
                <Input
                  id="work_end_time"
                  type="time"
                  value={settings.work_end_time}
                  onChange={(e) => updateSetting("work_end_time", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lunch_start_time">점심 시작</Label>
                <Input
                  id="lunch_start_time"
                  type="time"
                  value={settings.lunch_start_time}
                  onChange={(e) => updateSetting("lunch_start_time", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lunch_end_time">점심 종료</Label>
                <Input
                  id="lunch_end_time"
                  type="time"
                  value={settings.lunch_end_time}
                  onChange={(e) => updateSetting("lunch_end_time", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <Save className="size-4" />
                저장
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
