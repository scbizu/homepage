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
			vecty.Text("this site will stay in maintance in a long-long time,you can find me via telegram @scnace"),
		),
	)
}

func main() {
	vecty.SetTitle("scnace|一只菜鸡的成长之路")
	vecty.RenderBody(&Homepage{})
}
