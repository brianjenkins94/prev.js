<img height="128px" width="128px" align="right" />

# Prev.js

> The React framework for people who don't want to learn React.

<table>
	<thead>
		<tr>
			<th align="center"><strong>Contents</strong></th>
		</tr>
	</thead>
	<tbody>
		<tr>
			<td>
				<ol>
					<li><a href="#origin">Origin</a></li>
					<li><a href="#foundation">Foundation</a></li>
					<ol>
						<li><a href="#design-goals">Design Goals</a></li>
					</ol>
					<li><a href="#features">Features</a></li>
					<ol>
						<li><a href="#wip">WIP</a></li>
					</ol>
					<li><a href="#faq">FAQ</a></li>
					<li><a href="#license">License</a></li>
				</ol>
			</td>
		</tr>
	</tbody>
</table>

### Origin

`Prev.js` is the successor to `kerplow`. `kerplow` was a utility I wrote for myself to rapidly prototype TypeScript applications without needing to tediously set up boilerplate. `kerplow` was a project configurator that deleted itself when it was done. `kerplow` was "*Project configuration that self-destructs!*".

`kerplow` originally included things like `express`, `ejs`, `sass`, and `rollup`.

`Prev.js` includes much less.

### Foundation

As you hopefully inferred, `Prev.js` primarily includes `Next.js`.

`Prev.js` uses `Next.js`'s underlying web server instead of `express`.

`Prev.js` provides a `routes` folder to complement the `pages` folder you're already used to, which allows you to use `Next.js` as if it were `express`.

#### Design Goals

1. Convention over configuration
	-   Limit top-level directory clutter
3. Everything should "just work"
4. Follow `Next.js` convention

### Features

#### File-system based routing

Using the same file [file-system based routing](https://nextjs.org/docs/routing/introduction) that you're already used to, creating a route takes as little as:

```ts
export function get(request, response:) {
	response.json({
		"hello": "world!"
	});
}
```

#### Built-in templating engine

And there's a built-in (`ejs`-like) templating engine too:

```ts
export function get(request, response) {
	response.render("index", {
		"hello": "world!"
	});
}
```

### FAQ

**So you've painstakingly hacked `express` into `Next.js` so that you don't have to learn React?**

Yep!

### License

`Prev.js` is licensed under the [MIT License](https://github.com/brianjenkins94/kerplow/blob/master/prev.js/LICENSE).

All files located in the `node_modules` directory are externally maintained libraries used by this software which have their own licenses; it is recommend that you read them, as their terms may differ from the terms in the MIT License.
