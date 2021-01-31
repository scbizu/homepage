package components

import (
	"github.com/hexops/vecty"
	"github.com/hexops/vecty/elem"
)

// Text defines the text structure
type Text struct {
	vecty.Core
}

// Render renders the text components structrue
func (t *Text) Render() vecty.ComponentOrHTML {
	return elem.Heading1(
		vecty.Text("scnace's Homepage - With The GEEKER Heart Forever."),
	)
}
