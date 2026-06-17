package routes

import (
	"bytes"
	"html/template"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSelected(t *testing.T) {
	assert.Equal(t, "selected", selected("last_7_days", "last_7_days"))
	assert.Equal(t, "", selected("last_7_days", "month"))

	// differing dynamic types must not match (and must not panic)
	assert.Equal(t, "", selected(0, "0"))
}

// TestSelected_TemplateExecution guards the real usage: a string literal in the
// template (e.g. {{ selected .Interval "month" }}) compares correctly against a
// string field and renders the bare "selected" attribute.
func TestSelected_TemplateExecution(t *testing.T) {
	tpl := template.Must(template.New("t").Funcs(template.FuncMap{"selected": selected}).Parse(
		`<o>{{ selected .Interval "month" }}</o>`,
	))

	var buf bytes.Buffer
	assert.NoError(t, tpl.Execute(&buf, map[string]any{"Interval": "month"}))
	assert.Equal(t, "<o>selected</o>", buf.String())

	buf.Reset()
	assert.NoError(t, tpl.Execute(&buf, map[string]any{"Interval": "any"}))
	assert.Equal(t, "<o></o>", buf.String())
}
