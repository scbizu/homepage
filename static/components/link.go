package components

import (
	"github.com/gopherjs/vecty"
	"github.com/gopherjs/vecty/elem"
	"github.com/gopherjs/vecty/prop"
)

// About defines the about information
type About struct {
	vecty.Core
}

// Render renders the about div
func (a *About) Render() vecty.ComponentOrHTML {
	return elem.Paragraph(
		vecty.Markup(prop.ID("scnace-about")),
		//GitHub
		elem.Anchor(
			vecty.Markup(
				prop.Href("https://github.com/scbizu/"),
				vecty.Class("link"),
			),
			vecty.Text("GitHub"),
		),
		//Blog
		elem.Anchor(
			vecty.Markup(
				prop.Href("https://blog.scnace.me/"),
				vecty.Class("link"),
			),
			vecty.Text("Blog"),
		),
		//Telegram Channel
		elem.Anchor(
			vecty.Markup(
				prop.Href("https://t.me/aboutNace"),
				vecty.Class("link"),
			),
			vecty.Text("Telegram Channel"),
		),
		//Twitter
		elem.Anchor(
			vecty.Markup(
				prop.Href("https://twitter.com/scnace/"),
				vecty.Class("link"),
			),
			vecty.Text("Twitter"),
		),
	)
}
