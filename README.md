# NoCap

A tiny Gen-Z programming language written in TypeScript.

## Install

Requires Node.js 20 or newer.

```sh
npm install --global nocap-lang
```

## Run

Create a file named `hello.np`:

```nocap
yo chat
flex "Hello, chat!";
aight, touch grass
```

Run it with:

```sh
nocap hello.np
```

Check syntax without running:

```sh
nocap --check hello.np
```

## Example: recursive factorial

Save this as `factorial.np`:

```nocap
yo chat

cook factorial(number) {
  vibe check (number <= 1) {
    serve 1;
  }

  serve number * factorial(number - 1);
}

soft launch number = 6;
flex "Factorial of", number, "is", factorial(number);

aight, touch grass
```

```sh
nocap factorial.np
```

Output:

```text
Factorial of 6 is 720
```

## Syntax

| NoCap | Meaning |
| --- | --- |
| `yo chat` | Start program |
| `aight, touch grass` | End program |
| `soft launch x = value;` | Create variable |
| `flex x;` | Print value |
| `no cap` / `delulu` | True / false |
| `ghosted` | Null |
| `vibe check (condition)` | If |
| `not the vibe` | Else |
| `keep cooking while (condition)` | While loop |
| `ghosting;` | Continue loop |
| `cooked;` | Break loop |
| `cook name(args) { ... }` | Create function |
| `serve value;` | Return from function |
| `crash out value;` | Throw error |
| `caught in 4K (error)` | Catch error |

Statements end with `;`. Supported operators are `+ - * / %`, comparisons, `== !=`, `&& || !`, and assignment operators such as `+=`.

MIT licensed.
