package main

import (
	"github.com/gopherjs/vecty"
	"github.com/gopherjs/vecty/elem"
)

// Homepage defines full view of https://scnace.me/
type Homepage struct {
	vecty.Core
}

// Render implements the vecty.Component interface.
func (hp *Homepage) Render() vecty.ComponentOrHTML {
	return elem.Body(
		elem.Paragraph(
			vecty.Text("Hello scnace"),
		),
	)
}

func main() {
	vecty.SetTitle("Welcome,Here is nace :-)")
	vecty.RenderBody(&Homepage{})
}
