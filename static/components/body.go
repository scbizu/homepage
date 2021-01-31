package components

import (
	"github.com/hexops/vecty"
	"github.com/hexops/vecty/elem"
	"github.com/hexops/vecty/prop"
)

// Body defines the body structrue
type Body struct {
	vecty.Core
}

// Render renders the body components structrue
func (b *Body) Render() vecty.ComponentOrHTML {
	return elem.Div(
		vecty.Markup(prop.ID("scnace-body")),
		&Text{},
		&About{},
	)
}
