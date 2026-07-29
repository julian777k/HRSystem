import { kstStartOfDay } from '@/lib/kst';

/** 1회 구매 이용권의 기본 사용 기간 (년). 약관 제12조 */
export const LICENSE_YEARS = 10;

/** 만료 사전 고지 기준 (개월). 약관 제13조 4항 — 만료 6개월 전까지 전환 조건 고지 */
export const LICENSE_NOTICE_MONTHS = 6;

export type LicenseStatus = 'none' | 'active' | 'expiring' | 'expired' | 'subscription';

export interface LicenseInfo {
    status: LicenseStatus;
    /** 만료까지 남은 일수. 만료됐으면 음수, 결제 전·구독 전환 후면 null */
    daysLeft: number | null;
    expiresAt: Date | null;
    /** 사전 고지 대상인지 (만료 6개월 이내 + 아직 고지 안 함) */
    needsNotice: boolean;
    /** 구독 전환 가능한 상태인지 (1회 구매분이 만료 임박이거나 이미 만료됨) */
    canConvert: boolean;
}

export interface TenantLicenseFields {
    paidAt?: Date | string | null;
    licenseExpiresAt?: Date | string | null;
    licenseNotifiedAt?: Date | string | null;
    billingMode?: string | null;
    subscriptionStartedAt?: Date | string | null;
    subscriptionFee?: number | null;
}

/** 결제일로부터 이용 종료일을 계산한다. */
export function calcLicenseExpiry(paidAt: Date, years: number = LICENSE_YEARS): Date {
    const d = new Date(paidAt);
    d.setFullYear(d.getFullYear() + years);
    return d;
}

/**
 * 테넌트의 이용 기간 상태를 판정한다.
 * 날짜 비교는 KST 자정 기준 — Workers는 UTC라 직접 비교하면 최대 9시간 어긋난다.
 */
export function getLicenseInfo(
    tenant: TenantLicenseFields,
    now: Date = new Date()
): LicenseInfo {
    // 구독으로 전환된 테넌트는 1회 구매 기간 개념이 끝난 상태다.
    if (tenant.billingMode === 'subscription') {
        return {
            status: 'subscription',
            daysLeft: null,
            expiresAt: tenant.licenseExpiresAt ? new Date(tenant.licenseExpiresAt) : null,
            needsNotice: false,
            canConvert: false,
        };
    }

    const expiresAt = tenant.licenseExpiresAt
        ? new Date(tenant.licenseExpiresAt)
        : tenant.paidAt
            ? calcLicenseExpiry(new Date(tenant.paidAt))
            : null;

    if (!expiresAt) {
        return { status: 'none', daysLeft: null, expiresAt: null, needsNotice: false, canConvert: false };
    }

    const today = kstStartOfDay(now).getTime();
    const end = kstStartOfDay(expiresAt).getTime();
    const daysLeft = Math.round((end - today) / 86_400_000);

    const noticeThreshold = LICENSE_NOTICE_MONTHS * 30;
    let status: LicenseStatus;
    if (daysLeft < 0) status = 'expired';
    else if (daysLeft <= noticeThreshold) status = 'expiring';
    else status = 'active';

    return {
        status,
        daysLeft,
        expiresAt,
        needsNotice: status === 'expiring' && !tenant.licenseNotifiedAt,
        canConvert: status === 'expiring' || status === 'expired',
    };
}

/** 관리자 화면 표시용 라벨 */
export function licenseLabel(info: LicenseInfo): string {
    switch (info.status) {
        case 'none':
            return '결제 전';
        case 'subscription':
            return '구독 이용 중';
        case 'expired':
            return `만료 (${Math.abs(info.daysLeft!)}일 경과)`;
        case 'expiring':
            return `만료 임박 (${info.daysLeft}일 남음)`;
        default: {
            const years = Math.floor(info.daysLeft! / 365);
            return years > 0 ? `이용 중 (약 ${years}년 남음)` : `이용 중 (${info.daysLeft}일 남음)`;
        }
    }
}
