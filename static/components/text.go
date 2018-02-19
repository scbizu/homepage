package components

import (
	"github.com/gopherjs/vecty"
	"github.com/gopherjs/vecty/elem"
)

// Text defines the text structrue
type Text struct {
	vecty.Core
}

// Render renders the text components structrue
func (t *Text) Render() vecty.ComponentOrHTML {
	return elem.Heading1(
		vecty.Text("scnace's Homepage - With The GEEKER Heart Forever."),
	)
}
