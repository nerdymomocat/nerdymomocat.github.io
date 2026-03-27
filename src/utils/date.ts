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

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isDateOnlyString(date: unknown): date is string {
	return typeof date === "string" && DATE_ONLY_PATTERN.test(date);
}

function parseDateOnlyString(date: string): Date {
	const [year, month, day] = date.split("-").map(Number);
	return new Date(Date.UTC(year, month - 1, day));
}

export function getCalendarDateParts(date: string | number | Date) {
	if (typeof date === "string") {
		const match = date.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
		if (match) {
			return {
				year: Number(match[1]),
				month: Number(match[2]),
				day: Number(match[3]),
			};
		}
	}

	const parsedDate = new Date(date);
	if (Number.isNaN(parsedDate.getTime())) {
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
	if (!parts) return null;

	return `${parts.year.toString().padStart(4, "0")}-${parts.month
		.toString()
		.padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

export function getDateObject(date: string | number | Date | null | undefined): Date | null {
	if (!date) return null;

	if (date instanceof Date) {
		return Number.isNaN(date.getTime()) ? null : date;
	}

	if (isDateOnlyString(date)) {
		return parseDateOnlyString(date);
	}

	const parsedDate = new Date(date);
	return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
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

function toDateObject(date: string | number | Date): Date {
	return getDateObject(date) || new Date(date);
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

	const parsedDate = toDateObject(date);

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

	const ObjDate = toDateObject(date);

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
	const d1 = isDateOnlyString(date1) ? parseDateOnlyString(date1) : new Date(date1);
	const d2 = isDateOnlyString(date2) ? parseDateOnlyString(date2) : new Date(date2);

	return (
		d1.getUTCFullYear() !== d2.getUTCFullYear() ||
		d1.getUTCMonth() !== d2.getUTCMonth() ||
		d1.getUTCDate() !== d2.getUTCDate()
	);
}
