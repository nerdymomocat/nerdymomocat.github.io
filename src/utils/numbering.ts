export const LINKED_CONTENT_SYMBOLS = ["‡", "§", "Δ", "◊", "☞", "♠", "♦", "♣"];

export const getSymbolForLinkedContent = (index: number) => {
	const base = LINKED_CONTENT_SYMBOLS.length;
	let result = "";

	// Base-N encoding (like converting to base 8)
	do {
		result = LINKED_CONTENT_SYMBOLS[index % base] + result;
		index = Math.floor(index / base) - 1; // subtract 1 to make sequence continuous (like Excel columns)
	} while (index >= 0);

	return result;
};

export function numberToAlphabet(num: number): string {
	let result = "";
	let tempNum = num;
	while (tempNum > 0) {
		const remainder = (tempNum - 1) % 26;
		result = String.fromCharCode(97 + remainder) + result;
		tempNum = Math.floor((tempNum - 1) / 26);
	}
	return result;
}
