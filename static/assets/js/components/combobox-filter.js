function ComboboxFilter({type, options, selection, remote, minChars, debounceMs, project, multiple}) {
    return {
        $template: '#combobox-filter-template',
        $delimiters: ['${', '}'],
        type: type,
        multiple: !!multiple,
        options: options || [],
        remote: !!remote,
        minChars: minChars || 1,
        debounceMs: debounceMs || 300,
        project: project || '',
        query: '',
        open: false,
        loading: false,
        hint: '',
        visibleOptions: [],
        selection: multiple ? null : (selection || null), // single-select value
        selected: [],                                      // multi-select values
        _initialKey: '',                                   // to detect a real change on close
        _debounceTimer: null,
        _boundOutside: null,

        // ---- input / search ----
        onInput() {
            this.open = true
            if (this.remote) this.onRemoteInput()
            else this.filterLocal()
        },
        onFocus() {
            this.open = true
            if (!this.remote) {
                if (!this.visibleOptions.length) this.filterLocal()
            } else if (this.multiple && !this.query.trim() && this.selected.length && !this.visibleOptions.length) {
                // show already-selected branches (checked, removable) before the user types
                this.visibleOptions = this.selected.slice()
                this.hint = ''
            }
        },
        filterLocal() {
            const q = this.query.trim().toLowerCase()
            this.visibleOptions = q
                ? this.options.filter(o => String(o).toLowerCase().includes(q))
                : this.options.slice()
            this.hint = ''
        },
        onRemoteInput() {
            if (this._debounceTimer) {
                clearTimeout(this._debounceTimer)
                this._debounceTimer = null
            }
            const q = this.query.trim()
            if (q.length < this.minChars) {
                this.visibleOptions = []
                this.loading = false
                this.hint = `Type at least ${this.minChars} characters …`
                return
            }
            this.hint = ''
            this.loading = true
            this._debounceTimer = setTimeout(() => this.fetchRemote(q), this.debounceMs)
        },
        fetchRemote(q) {
            const params = new URLSearchParams()
            if (this.project) params.set('project', this.project)
            params.set('q', q)
            // forward the current time selection so only branches active in that interval are returned
            const current = new URLSearchParams(window.location.search)
            for (const key of ['interval', 'start', 'from', 'to']) {
                if (current.has(key)) params.set(key, current.get(key))
            }
            fetch(`api/branches?${params.toString()}`, {headers: {'Accept': 'application/json'}})
                .then(res => {
                    if (!res.ok) throw new Error(`request failed with status ${res.status}`)
                    return res.json()
                })
                .then(data => {
                    this.visibleOptions = Array.isArray(data) ? data : []
                    this.loading = false
                    this.hint = this.visibleOptions.length ? '' : 'No matches'
                })
                .catch(err => {
                    console.error('branch search failed', err)
                    this.visibleOptions = []
                    this.loading = false
                    this.hint = 'Search failed'
                })
        },

        // ---- single-select ----
        select(option) {
            this.selection = option
            this.query = option
            this.open = false
            this.$nextTick(() => {
                const query = new URLSearchParams(window.location.search)
                const val = this.selection === 'unknown' ? '-' : this.selection // will break if the value is actually named "unknown"
                if (this.selection) query.set(this.type, val)
                else query.delete(this.type)
                // branches are project-scoped, so changing/clearing the project invalidates any active branch filter
                if (this.type === 'project') query.delete('branch')
                window.location.search = query.toString()
            })
        },

        // ---- multi-select ----
        isSelected(o) { return this.selected.includes(o) },
        toggle(o) {
            this.selected = this.selected.includes(o)
                ? this.selected.filter(x => x !== o)
                : [...this.selected, o]
        },
        allVisibleSelected() {
            return this.visibleOptions.length > 0 && this.visibleOptions.every(o => this.selected.includes(o))
        },
        selectAllVisible() {
            if (this.allVisibleSelected()) {
                this.selected = this.selected.filter(o => !this.visibleOptions.includes(o))
            } else {
                this.selected = [...new Set([...this.selected, ...this.visibleOptions])]
            }
        },
        clearAll() { this.selected = [] },
        placeholderText() {
            if (this.multiple && !this.open && this.selected.length) {
                return this.selected.length + (this.selected.length === 1 ? ' branch selected' : ' branches selected')
            }
            return 'Filter by ' + this.type + ' ...'
        },

        // ---- open / close ----
        closeAndApply() {
            this.open = false
            if (this.multiple) this.applyMulti()
        },
        applyMulti() {
            const key = this.selected.slice().sort().join('')
            if (key === this._initialKey) return // nothing changed -> no reload
            const query = new URLSearchParams(window.location.search)
            query.delete(this.type)
            this.selected.forEach(b => query.append(this.type, b))
            window.location.search = query.toString()
        },
        onKeydown(e) {
            if (e.key === 'Escape') this.closeAndApply()
        },
        onClickOutside(e) {
            if (this.$el && !this.$el.contains(e.target)) this.closeAndApply()
        },

        mounted() {
            const params = new URLSearchParams(window.location.search)
            if (this.multiple) {
                this.selected = params.getAll(this.type).filter(Boolean)
                this._initialKey = this.selected.slice().sort().join('')
            } else if (params.has(this.type)) {
                const val = params.get(this.type) === '-' ? 'unknown' : params.get(this.type)
                this.selection = val
                this.query = val
            }
            if (!this.remote && !this.multiple) this.filterLocal()
            this._boundOutside = e => this.onClickOutside(e)
            document.addEventListener('click', this._boundOutside)
        },
    }
}
