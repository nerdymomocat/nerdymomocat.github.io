const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_PREFIX_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/;

const dateOptions = {
	date: {
		locale: "en",
		options: {
			day: "numeric",
			month: "short",
			year: "numeric",
		},
	},
};

const dateFormat = new Intl.DateTimeFormat(dateOptions.date.locale, dateOptions.date.options);

function parseDateOnlyString(date: string): Date {
	const [year, month, day] = date.split("-").map(Number);
	return new Date(Date.UTC(year, month - 1, day));
}

function isValidDate(date: Date): boolean {
	return !Number.isNaN(date.getTime());
}

export function isDateOnlyString(date: unknown): date is string {
	return typeof date === "string" && DATE_ONLY_PATTERN.test(date);
}

function getCalendarDatePartsFromSourceString(date: string) {
	const match = date.match(ISO_DATE_PREFIX_PATTERN);
	if (!match) {
		return null;
	}

	return {
		year: Number(match[1]),
		month: Number(match[2]),
		day: Number(match[3]),
	};
}

export function getDateObject(date: string | number | Date): Date | null {
	if (date instanceof Date) {
		return isValidDate(date) ? date : null;
	}

	if (isDateOnlyString(date)) {
		return parseDateOnlyString(date);
	}

	const parsedDate = new Date(date);
	return isValidDate(parsedDate) ? parsedDate : null;
}

export function getDateTimeValue(date: string | number | Date): string {
	if (isDateOnlyString(date)) {
		return date;
	}

	const parsedDate = getDateObject(date);
	return parsedDate ? parsedDate.toISOString() : "";
}

export function getMachineDateISOString(date: string | number | Date): string | null {
	const parsedDate = getDateObject(date);
	return parsedDate ? parsedDate.toISOString() : null;
}

export function getCalendarDateParts(date: string | number | Date) {
	if (typeof date === "string") {
		const sourceParts = getCalendarDatePartsFromSourceString(date);
		if (sourceParts) {
			return sourceParts;
		}
	}

	const parsedDate = getDateObject(date);
	if (!parsedDate) {
		return null;
	}

	return {
		year: parsedDate.getUTCFullYear(),
		month: parsedDate.getUTCMonth() + 1,
		day: parsedDate.getUTCDate(),
	};
}

export function getCalendarDateString(date: string | number | Date): string | null {
	const parts = getCalendarDateParts(date);
	if (!parts) {
		return null;
	}

	return `${parts.year.toString().padStart(4, "0")}-${parts.month
		.toString()
		.padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

function getCalendarDateKey(date: string | number | Date): string | null {
	if (isDateOnlyString(date)) {
		return date;
	}

	return getCalendarDateString(date);
}

export function getFormattedDate(
	date: string | number | Date,
	options?: Intl.DateTimeFormatOptions,
) {
	const formatOptions = {
		...(dateOptions.date.options as Intl.DateTimeFormatOptions),
		...options,
	};

	if (isDateOnlyString(date)) {
		return new Intl.DateTimeFormat(dateOptions.date.locale, {
			...formatOptions,
			timeZone: "UTC",
		}).format(parseDateOnlyString(date));
	}

	const parsedDate = getDateObject(date);
	if (!parsedDate) {
		return "";
	}

	if (typeof options !== "undefined") {
		return parsedDate.toLocaleDateString(dateOptions.date.locale, formatOptions);
	}

	return dateFormat.format(parsedDate);
}

export function getFormattedDateWithTime(date: string | number | Date) {
	if (isDateOnlyString(date)) {
		return new Intl.DateTimeFormat("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			timeZone: "UTC",
		}).format(parseDateOnlyString(date));
	}

	const ObjDate = getDateObject(date);
	if (!ObjDate) {
		return "";
	}

	// Check if the date string contains a 'T' or if it's a number or Date object
	let showTime = false;
	if (typeof date === "string") {
		showTime = date.includes("T");
	} else {
		// For number or Date types, we assume time might be relevant
		showTime = true;
	}

	const options: Intl.DateTimeFormatOptions = {
		year: "numeric",
		month: "short",
		day: "numeric",
		...(showTime && { hour: "2-digit", minute: "2-digit", hour12: true }),
	};

	const formattedDate = ObjDate.toLocaleString("en-US", options);
	return formattedDate;
}

export function areDifferentDates(date1: string | number | Date, date2: string | number | Date) {
	const d1 = getCalendarDateKey(date1);
	const d2 = getCalendarDateKey(date2);

	if (!d1 || !d2) {
		return false;
	}

	return d1 !== d2;
}

export function compareDatesDescending(
	date1: string | number | Date,
	date2: string | number | Date,
) {
	const d1 = getMachineDateISOString(date1);
	const d2 = getMachineDateISOString(date2);

	if (!d1 && !d2) return 0;
	if (!d1) return 1;
	if (!d2) return -1;
	if (d1 === d2) return 0;
	return d1 < d2 ? 1 : -1;
}
