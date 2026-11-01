import { BUSINESS_TIME_ZONE, businessDateKey, timestampIso } from '../time';
import { DEFAULT_LOCALE, intlLocale } from '$lib/i18n/locales';
import { translate } from '$lib/i18n/translate';

export function formatRelativeDate(value: string, locale: string = DEFAULT_LOCALE): string {
	const date = new Date(timestampIso(value) ?? NaN);
	if (!Number.isFinite(date.getTime())) return '';
	const now = new Date();
	const tag = intlLocale(locale);
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60_000);
	const diffHours = Math.floor(diffMs / 3_600_000);
	const diffDays = Math.floor(diffMs / 86_400_000);

	if (diffMins < 1) return translate(locale, 'date.now');
	if (diffMins < 60) return `${diffMins}m`;
	if (diffHours < 24 && isSameCalendarDay(date, now)) {
		return date.toLocaleTimeString(tag, { timeZone: BUSINESS_TIME_ZONE, hour: 'numeric', minute: '2-digit' });
	}
	if (diffDays < 7) {
		return date.toLocaleDateString(tag, { timeZone: BUSINESS_TIME_ZONE, weekday: 'short' });
	}
	return date.toLocaleDateString(tag, { timeZone: BUSINESS_TIME_ZONE, month: 'short', day: 'numeric' });
}

export function formatFullDate(value: string, locale: string = DEFAULT_LOCALE): string {
	return new Date(timestampIso(value) ?? NaN).toLocaleString(intlLocale(locale), {
		timeZone: BUSINESS_TIME_ZONE,
		timeZoneName: 'short',
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});
}

function validDate(value: string): Date | null {
	const date = new Date(timestampIso(value) ?? NaN);
	return Number.isNaN(date.getTime()) ? null : date;
}

function isSameCalendarDay(a: Date, b: Date): boolean {
	return businessDateKey(a) === businessDateKey(b);
}

/** Zero mail timestamps: time for recent mail, `MMM dd` this month, else a short date. */
export function formatMailDate(value: string, locale: string = DEFAULT_LOCALE): string {
	const date = validDate(value);
	if (!date) return '';
	const now = new Date();
	const hoursDifference = (now.getTime() - date.getTime()) / 3_600_000;
	if (isSameCalendarDay(date, now) || hoursDifference <= 12) {
		return formatMailTime(value, locale);
	}
	const [year, month] = businessDateKey(date).split('-').map(Number);
	const [nowYear, nowMonth] = businessDateKey(now).split('-').map(Number);
	const monthsApart = (nowYear - year) * 12 + nowMonth - month;
	if (monthsApart === 0 || monthsApart === 1) {
		return date.toLocaleDateString(intlLocale(locale), { timeZone: BUSINESS_TIME_ZONE, month: 'short', day: '2-digit' });
	}
	return date.toLocaleDateString(intlLocale(locale), {
		timeZone: BUSINESS_TIME_ZONE,
		month: '2-digit',
		day: '2-digit',
		year: '2-digit'
	});
}

export function formatMailTime(value: string, locale: string = DEFAULT_LOCALE): string {
	const date = validDate(value);
	if (!date) return '';
	return date.toLocaleTimeString(intlLocale(locale), { timeZone: BUSINESS_TIME_ZONE, hour: 'numeric', minute: '2-digit' });
}

/** Stack a second time line when the primary stamp is a calendar date. */
export function shouldShowSeparateTime(value: string): boolean {
	const date = validDate(value);
	if (!date) return false;
	const now = new Date();
	if (isSameCalendarDay(date, now)) return false;
	const hoursDifference = (now.getTime() - date.getTime()) / 3_600_000;
	return hoursDifference > 12;
}
