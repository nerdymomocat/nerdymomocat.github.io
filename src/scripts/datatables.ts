declare const simpleDatatables: {
	DataTable: new (
		table: HTMLTableElement,
		options: object,
	) => {
		wrapperDOM: HTMLElement;
		input: HTMLInputElement;
		data: string[][];
		activeRows: HTMLElement[];
		on: (event: string, callback: (this: any, query: string, matched: unknown) => void) => void;
		update: () => void;
		emit: (event: string, ...args: unknown[]) => void;
		search: (query: string) => void;
	};
};

document.addEventListener("DOMContentLoaded", function () {
	const dataTables = document.querySelectorAll("table.datatable");
	if (dataTables.length > 0) {
		// Load simple-datatables script
		const script = document.createElement("script");
		script.src = "https://cdn.jsdelivr.net/npm/simple-datatables@latest";
		script.onload = initDataTables;
		document.head.appendChild(script);

		// Load simple-datatables CSS (non-blocking)
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = "https://cdn.jsdelivr.net/npm/simple-datatables@latest/dist/style.min.css";
		link.media = "print"; // Initially set to print to avoid blocking
		link.onload = () => {
			link.media = "all"; // Switch to all once loaded
		};
		document.head.appendChild(link);
	}
});

function initDataTables() {
	const dataTables = document.querySelectorAll("table.datatable");
	let options = {
		searchable: true,
		paging: false,
		labels: { info: "{rows} rows" },
		tableRender: (_data: unknown, table: any, type: string) => {
			if (type === "print") {
				return table;
			}
			const tHead = table.childNodes[0];
			const filterHeaders = {
				nodeName: "TR",
				attributes: {
					class: "filter-row hide",
				},
				childNodes: tHead.childNodes[0].childNodes.map((_th: unknown, index: number) => ({
					nodeName: "TH",
					childNodes: [
						{
							nodeName: "INPUT",
							attributes: {
								class: "datatable-input",
								type: "search",
								"data-columns": `[${index}]`,
								"aria-label": `Filter column ${index + 1}`,
							},
						},
					],
				})),
			};
			tHead.childNodes.push(filterHeaders);
			return table;
		},
		template: (options: any, dom: { id?: string }) => `
      <div class='${options.classes.top}'>
        <div class="datatable-top-left">
          <button class="filter-toggle cursor-pointer" style="padding: 8px;" aria-label="Toggle filters and search">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 30 30">
              <path fill="currentColor" d="M19.3 17.89c1.32-2.1.7-4.89-1.41-6.21a4.52 4.52 0 0 0-6.21 1.41C10.36 15.2 11 18 13.09 19.3c1.47.92 3.33.92 4.8 0L21 22.39L22.39 21zm-2-.62c-.98.98-2.56.97-3.54 0c-.97-.98-.97-2.56.01-3.54c.97-.97 2.55-.97 3.53 0c.96.99.95 2.57-.03 3.54zM19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5.81a6.3 6.3 0 0 1-1.31-2H5v-4h4.18c.16-.71.43-1.39.82-2H5V8h6v2.81a6.3 6.3 0 0 1 2-1.31V8h6v2a6.5 6.5 0 0 1 2 2V6a2 2 0 0 0-2-2"/>
            </svg>
          </button>
          <div class='${options.classes.search} search-inputs hide' style="display: flex; gap: 10px;">
            <input class='${options.classes.input}' placeholder='OR search' type='search' aria-label='OR search' title='${options.labels.searchTitle}'${dom.id ? ` aria-controls="${dom.id}"` : ""}>
            <input class='${options.classes.input}' placeholder='AND search' type='search' aria-label='AND search' data-and="true" title='${options.labels.searchTitle}'${dom.id ? ` aria-controls="${dom.id}"` : ""}>
          </div>
        </div>
        <div class='${options.classes.info}'></div>
      </div>
      <div class='${options.classes.container}'${options.scrollY.length ? ` style='height: ${options.scrollY}; overflow-Y: auto;'` : ""}></div>
    `,
	};

	dataTables.forEach((table) => {
		if (!(table instanceof HTMLTableElement)) return;
		const dt = new simpleDatatables.DataTable(table, options);

		// Custom search function
		const customSearch = (query: string, row: string, andSearch: boolean) => {
			const searchTerms = query.toLowerCase().split(" ");
			const rowData = row.toLowerCase();

			if (andSearch) {
				return searchTerms.every((term) => rowData.includes(term));
			} else {
				return searchTerms.some((term) => rowData.includes(term));
			}
		};

		// Override the default search behavior
		dt.on("datatable.search", function (this: any, query: string, matched: unknown) {
			const andSearchInput = this.wrapperDOM.querySelector('input[data-and="true"]');
			const andSearchQuery = andSearchInput ? andSearchInput.value : "";
			const columnFilters = Array.from(
				this.wrapperDOM.querySelectorAll(".datatable-input") as NodeListOf<HTMLInputElement>,
			).map((input: HTMLInputElement) => input.value);

			this.data.forEach((row: string[], index: number) => {
				const tr = this.activeRows[index];
				const orMatch = customSearch(query, row.join(" "), false);
				const andMatch = customSearch(andSearchQuery, row.join(" "), true);
				const columnMatch = columnFilters.every(
					(filter, i) => filter === "" || customSearch(filter, row[i] || "", false),
				);

				if (orMatch && andMatch && columnMatch) {
					tr.style.display = "";
				} else {
					tr.style.display = "none";
				}
			});

			this.update();
			this.emit("datatable.afterSearch", query, matched);
		});

		// Add event listener for AND search
		const andSearchInput = dt.wrapperDOM.querySelector<HTMLInputElement>('input[data-and="true"]');
		andSearchInput?.addEventListener("keyup", function () {
			dt.search(dt.input.value);
		});

		// Add event listeners for column filters
		const columnFilters = dt.wrapperDOM.querySelectorAll<HTMLInputElement>(".datatable-input");
		columnFilters.forEach((input) => {
			input.addEventListener("keyup", function () {
				dt.search(dt.input.value);
			});
		});

		// Add event listener for filter toggle button
		const filterToggle = dt.wrapperDOM.querySelector<HTMLElement>(".filter-toggle");
		const filterRow = dt.wrapperDOM.querySelector<HTMLElement>(".filter-row");
		const searchInputs = dt.wrapperDOM.querySelector<HTMLElement>(".search-inputs");
		const datatableTop = dt.wrapperDOM.querySelector<HTMLElement>(".datatable-top");
		if (!filterToggle || !filterRow || !searchInputs || !datatableTop) return;
		filterToggle.addEventListener("click", function () {
			const columnFilters = dt.wrapperDOM.querySelectorAll<HTMLInputElement>(".datatable-input");
			const areAllEmpty = Array.from(columnFilters).every(
				(input: HTMLInputElement) => input.value === "",
			);
			const isHidden = filterRow.classList.contains("hide");

			if (isHidden || !areAllEmpty) {
				filterRow.classList.remove("hide");
				searchInputs.classList.remove("hide");
				datatableTop.classList.add("filter-active");
				filterToggle.setAttribute("aria-expanded", "true");
			} else {
				filterRow.classList.add("hide");
				searchInputs.classList.add("hide");
				datatableTop.classList.remove("filter-active");
				filterToggle.setAttribute("aria-expanded", "false");
			}
		});

		// Set initial aria-expanded state
		filterToggle.setAttribute("aria-expanded", "false");
	});
}
