"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Database,
  Building2,
  UserCog,
  Sprout,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Info,
  FileSpreadsheet,
  Users,
  Settings,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

const isSQLiteMode = process.env.NEXT_PUBLIC_DB_PROVIDER === "sqlite";
const isCloudflare = process.env.NEXT_PUBLIC_DEPLOY_TARGET === "cloudflare";

interface SetupFormData {
  // Step 2: Company
  companyName: string;
  bizNumber: string;
  representative: string;
  address: string;
  // Step 3: Admin
  employeeNumber: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  adminPasswordConfirm: string;
  adminPosition: string;
}

const STEPS = [
  { number: 1, label: isCloudflare ? "D1 연결 확인" : isSQLiteMode ? "DB 초기화" : "DB 연결 확인", icon: Database },
  { number: 2, label: "회사 정보", icon: Building2 },
  { number: 3, label: "관리자 계정", icon: UserCog },
  { number: 4, label: "기본 데이터", icon: Sprout },
  { number: 5, label: "완료", icon: CheckCircle2 },
];

const POSITIONS = [
  "대표",
  "이사",
  "부장",
  "차장",
  "과장",
  "대리",
  "사원",
];

const defaultFormData: SetupFormData = {
  companyName: "",
  bizNumber: "",
  representative: "",
  address: "",
  employeeNumber: "",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
  adminPasswordConfirm: "",
  adminPosition: "대표",
};

export default function SetupPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<SetupFormData>(defaultFormData);
  const [dbStatus, setDbStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [dbMessage, setDbMessage] = useState("");
  const [seedStatus, setSeedStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [seedMessage, setSeedMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [errors, setErrors] =
    useState<Partial<Record<keyof SetupFormData, string>>>({});

  // Check if setup is already complete on mount
  useEffect(() => {
    fetch("/api/setup/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.isComplete) {
          router.replace("/login");
        }
      })
      .catch(() => {
        // DB might not be reachable yet, that's OK
      });
  }, [router]);

  // SQLite auto-initialization
  const handleAutoInitDb = useCallback(async () => {
    setDbStatus("loading");
    setDbMessage("데이터베이스 자동 초기화 중...");

    try {
      // Test DB path
      const testRes = await fetch("/api/setup/test-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const testData = await testRes.json();

      if (!testRes.ok || !testData.success) {
        setDbStatus("error");
        setDbMessage(testData.message || "데이터베이스 경로 확인 실패");
        return;
      }

      // Initialize schema
      setDbMessage("스키마 생성 중...");
      const initRes = await fetch("/api/setup/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const initData = await initRes.json();

      if (!initRes.ok || !initData.success) {
        setDbStatus("error");
        setDbMessage(initData.message || "스키마 초기화 실패");
        return;
      }

      setDbStatus("success");
      setDbMessage("SQLite 데이터베이스 초기화 완료");

      // Auto-advance after a short delay
      setTimeout(() => {
        setCurrentStep(2);
      }, 1000);
    } catch {
      setDbStatus("error");
      setDbMessage("데이터베이스 초기화 중 오류가 발생했습니다.");
    }
  }, []);

  // Auto-start DB init for SQLite mode
  useEffect(() => {
    if (isSQLiteMode && currentStep === 1 && dbStatus === "idle") {
      handleAutoInitDb();
    }
  }, [currentStep, dbStatus, handleAutoInitDb]);

  const updateField = (field: keyof SetupFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<keyof SetupFormData, string>> = {};

    if (step === 2) {
      if (!formData.companyName.trim())
        newErrors.companyName = "회사명을 입력해주세요";
    }

    if (step === 3) {
      if (!formData.employeeNumber.trim())
        newErrors.employeeNumber = "사번을 입력해주세요";
      if (!formData.adminName.trim())
        newErrors.adminName = "이름을 입력해주세요";
      if (!formData.adminEmail.trim())
        newErrors.adminEmail = "이메일을 입력해주세요";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail))
        newErrors.adminEmail = "올바른 이메일 형식을 입력해주세요";
      if (!formData.adminPassword)
        newErrors.adminPassword = "비밀번호를 입력해주세요";
      else if (formData.adminPassword.length < 8)
        newErrors.adminPassword = "비밀번호는 8자 이상이어야 합니다";
      if (formData.adminPassword !== formData.adminPasswordConfirm)
        newErrors.adminPasswordConfirm = "비밀번호가 일치하지 않습니다";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Step 1: Auto-test DB connection using DATABASE_URL from env
  const handleTestDb = async () => {
    setDbStatus("loading");
    setDbMessage("");
    try {
      const res = await fetch("/api/setup/test-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDbStatus("success");
        setDbMessage(data.version ? `데이터베이스 연결 성공 (${data.version.split(",")[0]})` : "데이터베이스 연결에 성공했습니다.");
      } else {
        setDbStatus("error");
        setDbMessage(data.message || "데이터베이스 연결에 실패했습니다.");
      }
    } catch {
      setDbStatus("error");
      setDbMessage("서버에 연결할 수 없습니다. 데이터베이스 설정을 확인해주세요.");
    }
  };

  // Step 4: 기본 데이터 생성 + 시스템 설정 완료 (한번에 처리)
  const handleComplete = async () => {
    setIsSubmitting(true);
    setSetupError("");
    setSeedStatus("loading");
    setSeedMessage("");
    try {
      if (!isSQLiteMode) {
        // Non-SQLite: run DB schema initialization
        const initRes = await fetch("/api/setup/initialize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!initRes.ok) {
          const initData = await initRes.json();
          setSetupError(`DB 초기화 실패: ${initData.message}`);
          setSeedStatus("error");
          setIsSubmitting(false);
          return;
        }
      }

      // 2) 기본 데이터 생성 (부서, 직급, 휴가유형, 시간외근무 정책)
      const seedRes = await fetch("/api/setup/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const seedData = await seedRes.json();
      if (!seedRes.ok || !seedData.success) {
        setSetupError(seedData.message || "기본 데이터 생성 실패");
        setSeedStatus("error");
        setSeedMessage(seedData.message || "");
        setIsSubmitting(false);
        return;
      }
      setSeedStatus("success");
      setSeedMessage(
        `부서 ${seedData.departments}개, 직급 ${seedData.positions}개, 휴가유형 ${seedData.leaveTypes}개 생성`
      );

      // 3) 관리자 계정 + 회사 설정 저장
      // db config is not used; DATABASE_URL env var is the proper way to configure the database connection
      const payload = {
        db: {},
        company: {
          name: formData.companyName,
          bizNumber: formData.bizNumber,
          representative: formData.representative,
          address: formData.address,
        },
        admin: {
          employeeNumber: formData.employeeNumber,
          name: formData.adminName,
          email: formData.adminEmail,
          password: formData.adminPassword,
          department: "경영지원",
          position: formData.adminPosition,
        },
        policies: {
          leaveBasis: "hire_date",
          amHalfStart: "09:00",
          amHalfEnd: "13:00",
          pmHalfStart: "14:00",
          pmHalfEnd: "18:00",
          approvalLevels: 2,
          unusedLeavePolicy: "expire",
        },
      };

      const res = await fetch("/api/setup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setCurrentStep(5);
      } else {
        const data = await res.json();
        setSetupError(data.message || "설정 저장 중 오류가 발생했습니다.");
      }
    } catch (err) {
      setSetupError(
        `서버 오류: ${err instanceof Error ? err.message : "연결 실패"}`
      );
      setSeedStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const progressValue = (currentStep / 5) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">
          KeystoneHR 초기 설정
        </h1>
        <p className="text-sm text-slate-500">
          시스템을 사용하기 위한 초기 설정을 진행합니다.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between px-2">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = currentStep > step.number;
          const isCurrent = currentStep === step.number;

          return (
            <div key={step.number} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                    isCompleted
                      ? "bg-green-500 border-green-500 text-white"
                      : isCurrent
                        ? "bg-blue-500 border-blue-500 text-white"
                        : "bg-white border-slate-300 text-slate-400"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="size-5" />
                  ) : (
                    <Icon className="size-5" />
                  )}
                </div>
                <span
                  className={`text-xs font-medium ${
                    isCurrent
                      ? "text-blue-600"
                      : isCompleted
                        ? "text-green-600"
                        : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-1 mt-[-1.25rem] ${
                    currentStep > step.number ? "bg-green-500" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress */}
      <Progress value={progressValue} className="h-1.5" />

      {/* Step 1: DB Connection Check / Auto Init */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="size-5 text-blue-500" />
              {isCloudflare ? "Cloudflare D1 연결 확인" : isSQLiteMode ? "데이터베이스 초기화" : "데이터베이스 연결 확인"}
            </CardTitle>
            <CardDescription>
              {isCloudflare
                ? "Cloudflare D1 데이터베이스 연결 상태를 확인합니다."
                : isSQLiteMode
                  ? "내장 데이터베이스를 자동으로 초기화합니다."
                  : "환경변수에 설정된 데이터베이스 연결을 테스트합니다."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isSQLiteMode ? (
              // SQLite/D1 auto-init UI
              <div className="text-center py-6">
                <div className="rounded-lg border bg-blue-50 border-blue-200 p-3 mb-4 text-left">
                  <div className="flex gap-2">
                    <Info className="size-4 text-blue-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-700">
                      {isCloudflare
                        ? "Cloudflare D1 데이터베이스가 자동으로 연결됩니다. 별도 설정이 필요 없습니다."
                        : "별도의 데이터베이스 소프트웨어가 필요 없습니다. 앱 내부에 데이터가 안전하게 저장됩니다."}
                    </p>
                  </div>
                </div>
                {dbStatus === "loading" && (
                  <div className="space-y-3">
                    <Loader2 className="size-10 animate-spin mx-auto text-blue-500" />
                    <p className="text-sm text-slate-600">{dbMessage}</p>
                  </div>
                )}
                {dbStatus === "success" && (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle2 className="size-4 text-green-600" />
                    <AlertTitle className="text-green-800">초기화 완료</AlertTitle>
                    <AlertDescription className="text-green-700">
                      {dbMessage}
                    </AlertDescription>
                  </Alert>
                )}
                {dbStatus === "error" && (
                  <>
                    <Alert variant="destructive">
                      <AlertCircle className="size-4" />
                      <AlertTitle>초기화 실패</AlertTitle>
                      <AlertDescription>{dbMessage}</AlertDescription>
                    </Alert>
                    <Button
                      variant="outline"
                      onClick={handleAutoInitDb}
                      className="mt-4"
                    >
                      다시 시도
                    </Button>
                  </>
                )}
              </div>
            ) : (
              // 외부 DB 연결 테스트 UI
              <>
                <div className="rounded-lg border bg-slate-50 p-4">
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">DATABASE_URL</span> 환경변수가
                    .env 파일에 올바르게 설정되어 있어야 합니다.
                  </p>
                </div>

                <Button
                  variant="outline"
                  onClick={handleTestDb}
                  disabled={dbStatus === "loading"}
                  className="w-full"
                >
                  {dbStatus === "loading" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      연결 테스트 중...
                    </>
                  ) : (
                    <>
                      <Database className="size-4" />
                      연결 테스트
                    </>
                  )}
                </Button>

                {dbStatus === "success" && (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle2 className="size-4 text-green-600" />
                    <AlertTitle className="text-green-800">연결 성공</AlertTitle>
                    <AlertDescription className="text-green-700">
                      {dbMessage}
                    </AlertDescription>
                  </Alert>
                )}

                {dbStatus === "error" && (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertTitle>연결 실패</AlertTitle>
                    <AlertDescription>{dbMessage}</AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={handleNext} disabled={dbStatus !== "success"}>
              다음
              <ChevronRight className="size-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 2: Company Info */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-5 text-blue-500" />
              회사 정보
            </CardTitle>
            <CardDescription>
              회사 기본 정보를 입력해주세요. 나중에 설정에서 수정할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">
                회사명 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => updateField("companyName", e.target.value)}
                placeholder="주식회사 OO"
              />
              {errors.companyName && (
                <p className="text-xs text-red-500">{errors.companyName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bizNumber">사업자번호</Label>
              <Input
                id="bizNumber"
                value={formData.bizNumber}
                onChange={(e) => updateField("bizNumber", e.target.value)}
                placeholder="000-00-00000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="representative">대표자명</Label>
              <Input
                id="representative"
                value={formData.representative}
                onChange={(e) => updateField("representative", e.target.value)}
                placeholder="홍길동"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">주소</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="서울특별시 강남구 ..."
              />
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={handlePrev}>
              <ChevronLeft className="size-4" />
              이전
            </Button>
            <Button onClick={handleNext}>
              다음
              <ChevronRight className="size-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 3: Admin Account */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="size-5 text-blue-500" />
              관리자 계정 생성
            </CardTitle>
            <CardDescription>
              시스템 최초 관리자 계정을 생성합니다. 이 계정으로 직원 등록, 휴가 관리 등 모든 기능을 사용할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employeeNumber">
                  사번 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="employeeNumber"
                  value={formData.employeeNumber}
                  onChange={(e) =>
                    updateField("employeeNumber", e.target.value)
                  }
                  placeholder="0001"
                />
                {errors.employeeNumber && (
                  <p className="text-xs text-red-500">
                    {errors.employeeNumber}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminName">
                  이름 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="adminName"
                  value={formData.adminName}
                  onChange={(e) => updateField("adminName", e.target.value)}
                  placeholder="홍길동"
                />
                {errors.adminName && (
                  <p className="text-xs text-red-500">{errors.adminName}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminEmail">
                이메일 (로그인 ID) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="adminEmail"
                type="email"
                value={formData.adminEmail}
                onChange={(e) => updateField("adminEmail", e.target.value)}
                placeholder="admin@company.com"
              />
              {errors.adminEmail && (
                <p className="text-xs text-red-500">{errors.adminEmail}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adminPassword">
                  비밀번호 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="adminPassword"
                  type="password"
                  value={formData.adminPassword}
                  onChange={(e) =>
                    updateField("adminPassword", e.target.value)
                  }
                  placeholder="8자 이상"
                />
                {errors.adminPassword && (
                  <p className="text-xs text-red-500">
                    {errors.adminPassword}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminPasswordConfirm">
                  비밀번호 확인 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="adminPasswordConfirm"
                  type="password"
                  value={formData.adminPasswordConfirm}
                  onChange={(e) =>
                    updateField("adminPasswordConfirm", e.target.value)
                  }
                  placeholder="비밀번호 재입력"
                />
                {errors.adminPasswordConfirm && (
                  <p className="text-xs text-red-500">
                    {errors.adminPasswordConfirm}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>직급</Label>
              <Select
                value={formData.adminPosition}
                onValueChange={(value) => updateField("adminPosition", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="직급 선택" />
                </SelectTrigger>
                <SelectContent>
                  {POSITIONS.map((pos) => (
                    <SelectItem key={pos} value={pos}>
                      {pos}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={handlePrev}>
              <ChevronLeft className="size-4" />
              이전
            </Button>
            <Button onClick={handleNext}>
              다음
              <ChevronRight className="size-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 4: 설정 확인 및 완료 */}
      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sprout className="size-5 text-blue-500" />
              설정 확인 및 완료
            </CardTitle>
            <CardDescription>
              아래 내용을 확인하고 시스템 설정을 완료합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 입력 내용 요약 */}
            <div className="rounded-lg border p-4 space-y-3">
              <h4 className="text-sm font-medium text-slate-700">입력 정보 확인</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-slate-500">회사명</span>
                <span className="font-medium">{formData.companyName}</span>
                {formData.representative && (
                  <>
                    <span className="text-slate-500">대표자</span>
                    <span className="font-medium">{formData.representative}</span>
                  </>
                )}
                <span className="text-slate-500">관리자</span>
                <span className="font-medium">{formData.adminName} ({formData.adminEmail})</span>
                <span className="text-slate-500">직급</span>
                <span className="font-medium">{formData.adminPosition}</span>
              </div>
            </div>

            {/* 자동 생성 데이터 안내 */}
            <div className="rounded-lg border bg-slate-50 p-4">
              <h4 className="text-sm font-medium text-slate-700 mb-2">
                자동 생성되는 기본 데이터
              </h4>
              <div className="text-sm text-slate-600 space-y-1">
                <p>부서: 경영지원, 인사, 개발, 영업, 마케팅</p>
                <p>직급: 사원, 대리, 과장, 차장, 부장, 이사, 대표</p>
                <p>휴가유형: 연차, 오전반차, 오후반차, 경조사, 병가, 출산휴가, 배우자출산, 공가</p>
                <p>시간외근무: 기본 정책 (주 12시간, 월 52시간)</p>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                * 부서, 직급 등은 설정 완료 후 회사에 맞게 수정/추가할 수 있습니다.
              </p>
            </div>

            {/* 직원 데이터 안내 */}
            <div className="rounded-lg border bg-amber-50 border-amber-200 p-4">
              <div className="flex gap-2">
                <FileSpreadsheet className="size-5 text-amber-600 shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-amber-800">
                    기존 직원 데이터가 있으신가요?
                  </h4>
                  <p className="text-xs text-amber-700 mt-1">
                    설정 완료 후 <strong>설정 &gt; 직원관리</strong>에서 엑셀 파일(.xlsx)로 직원을 일괄 등록할 수 있습니다.
                    현재 엑셀이나 CSV로 관리하고 계신 직원 명부를 그대로 업로드하세요.
                  </p>
                </div>
              </div>
            </div>

            {seedStatus === "success" && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="size-4 text-green-600" />
                <AlertTitle className="text-green-800">데이터 생성 완료</AlertTitle>
                <AlertDescription className="text-green-700">
                  {seedMessage}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={handlePrev} disabled={isSubmitting}>
              <ChevronLeft className="size-4" />
              이전
            </Button>
            <Button onClick={handleComplete} disabled={isSubmitting} className="min-w-[180px]">
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  설정 진행 중...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  시스템 설정 완료
                </>
              )}
            </Button>
          </CardFooter>
          {setupError && (
            <div className="px-6 pb-6">
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>오류</AlertTitle>
                <AlertDescription>{setupError}</AlertDescription>
              </Alert>
            </div>
          )}
        </Card>
      )}

      {/* Step 5: Complete */}
      {currentStep === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-green-500" />
              설정 완료
            </CardTitle>
            <CardDescription>
              시스템 초기 설정이 완료되었습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                <CheckCircle2 className="size-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                KeystoneHR이 준비되었습니다
              </h3>
              <p className="text-sm text-slate-500 mt-2">
                관리자 계정으로 로그인하여 시스템을 사용할 수 있습니다.
              </p>
            </div>

            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">회사명</span>
                <span className="font-medium">{formData.companyName}</span>
              </div>
              {formData.representative && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">대표자</span>
                  <span className="font-medium">{formData.representative}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">관리자</span>
                <span className="font-medium">{formData.adminName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">로그인 이메일</span>
                <span className="font-medium">{formData.adminEmail}</span>
              </div>
            </div>

            {/* 다음 단계 안내 */}
            <div className="rounded-lg border bg-blue-50 border-blue-200 p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-3">
                로그인 후 이렇게 시작하세요
              </h4>
              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold shrink-0 mt-0.5">1</div>
                  <div>
                    <p className="text-sm font-medium text-blue-800 flex items-center gap-1">
                      <Users className="size-3.5" /> 직원 등록
                    </p>
                    <p className="text-xs text-blue-600">
                      설정 &gt; 직원관리에서 엑셀 파일로 일괄 등록하거나, 직원을 한 명씩 추가할 수 있습니다.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold shrink-0 mt-0.5">2</div>
                  <div>
                    <p className="text-sm font-medium text-blue-800 flex items-center gap-1">
                      <Settings className="size-3.5" /> 회사 맞춤 설정
                    </p>
                    <p className="text-xs text-blue-600">
                      부서, 직급, 휴가규정 등을 회사 상황에 맞게 수정하세요.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold shrink-0 mt-0.5">3</div>
                  <div>
                    <p className="text-sm font-medium text-blue-800 flex items-center gap-1">
                      <Calendar className="size-3.5" /> 휴가 자동부여
                    </p>
                    <p className="text-xs text-blue-600">
                      휴가 &gt; 부여관리에서 전직원 연차를 일괄 자동 부여할 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={() => router.push("/login")}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-base font-semibold"
            >
              <CheckCircle2 className="size-5" />
              로그인 페이지로 이동
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
