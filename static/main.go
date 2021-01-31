package main

import (
	"github.com/hexops/vecty"
	"github.com/hexops/vecty/elem"
	"github.com/hexops/vecty/prop"
	"github.com/scbizu/homepage/static/components"
)

// Homepage defines full view of https://scnace.me/
type Homepage struct {
	vecty.Core
}

// Render implements the vecty.Component interface.
func (hp *Homepage) Render() vecty.ComponentOrHTML {
	return elem.Body(
		vecty.Markup(prop.ID("home")),
		&components.Body{},
		&components.Footer{},
	)
}

func main() {
	vecty.SetTitle("scnace|一只菜鸡的成长之路")
	vecty.AddStylesheet("main.css")
	vecty.RenderBody(&Homepage{})
}
