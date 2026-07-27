export const VERSION = "1.2.0";

export type RuntimeValue = number | string | boolean | null;

export interface SourceLocation {
  readonly line: number;
  readonly column: number;
}

export type ErrorKind = "SyntaxError" | "RuntimeError";

export class NoCapError extends Error {
  readonly kind: ErrorKind;
  readonly filename: string;
  readonly location: SourceLocation;

  constructor(
    kind: ErrorKind,
    message: string,
    location: SourceLocation,
    filename = "<source>",
  ) {
    super(message);
    this.name = "NoCapError";
    this.kind = kind;
    this.filename = filename;
    this.location = location;
  }

  format(): string {
    return `${this.filename}:${this.location.line}:${this.location.column} - ${this.kind}: ${this.message}`;
  }
}

type KeywordToken =
  | "PROGRAM_START"
  | "PROGRAM_END"
  | "DECLARE"
  | "PRINT"
  | "NULL"
  | "TRUE"
  | "FALSE"
  | "IF"
  | "ELSE"
  | "WHILE"
  | "CONTINUE"
  | "BREAK"
  | "THROW"
  | "TRY"
  | "CATCH"
  | "FUNCTION"
  | "RETURN";

type TokenType =
  | KeywordToken
  | "NUMBER"
  | "STRING"
  | "IDENTIFIER"
  | "SYMBOL"
  | "EOF";

interface Token {
  readonly type: TokenType;
  readonly lexeme: string;
  readonly location: SourceLocation;
  readonly literal?: RuntimeValue;
}

interface KeywordDefinition {
  readonly type: KeywordToken;
  readonly pattern: RegExp;
}

const KEYWORDS: readonly KeywordDefinition[] = [
  { type: "PROGRAM_END", pattern: /^aight\s*,\s*touch\s+grass\b/ },
  { type: "WHILE", pattern: /^keep\s+cooking\s+while\b/ },
  { type: "CATCH", pattern: /^caught\s+in\s+4K\b/ },
  { type: "PROGRAM_START", pattern: /^yo\s+chat\b/ },
  { type: "DECLARE", pattern: /^soft\s+launch\b/ },
  { type: "IF", pattern: /^vibe\s+check\b/ },
  { type: "ELSE", pattern: /^not\s+the\s+vibe\b/ },
  { type: "TRUE", pattern: /^no\s+cap\b/ },
  { type: "CONTINUE", pattern: /^ghosting\b/ },
  { type: "NULL", pattern: /^ghosted\b/ },
  { type: "FALSE", pattern: /^delulu\b/ },
  { type: "BREAK", pattern: /^cooked\b/ },
  { type: "THROW", pattern: /^crash\s+out\b/ },
  { type: "TRY", pattern: /^try\s+this\b/ },
  { type: "FUNCTION", pattern: /^cook\b/ },
  { type: "RETURN", pattern: /^serve\b/ },
  { type: "PRINT", pattern: /^flex\b/ },
];

class Lexer {
  private readonly tokens: Token[] = [];
  private offset = 0;
  private line = 1;
  private column = 1;

  constructor(
    private readonly source: string,
    private readonly filename: string,
  ) {}

  scan(): readonly Token[] {
    while (!this.atEnd()) {
      this.skipIgnored();
      if (this.atEnd()) break;

      const location = this.location();
      if (this.scanKeyword(location)) continue;

      const char = this.peek();
      if (this.isDigit(char)) {
        this.scanNumber(location);
      } else if (this.isIdentifierStart(char)) {
        this.scanIdentifier(location);
      } else if (char === '"' || char === "'") {
        this.scanString(location);
      } else {
        this.scanSymbol(location);
      }
    }

    this.tokens.push({ type: "EOF", lexeme: "", location: this.location() });
    return this.tokens;
  }

  private scanKeyword(location: SourceLocation): boolean {
    const rest = this.source.slice(this.offset);
    for (const keyword of KEYWORDS) {
      const match = keyword.pattern.exec(rest);
      if (!match?.[0]) continue;
      this.advanceText(match[0]);
      this.tokens.push({ type: keyword.type, lexeme: match[0], location });
      return true;
    }
    return false;
  }

  private scanNumber(location: SourceLocation): void {
    const start = this.offset;
    while (this.isDigit(this.peek())) this.advance();
    if (this.peek() === "." && this.isDigit(this.peek(1))) {
      this.advance();
      while (this.isDigit(this.peek())) this.advance();
    }

    const lexeme = this.source.slice(start, this.offset);
    this.tokens.push({
      type: "NUMBER",
      lexeme,
      literal: Number(lexeme),
      location,
    });
  }

  private scanIdentifier(location: SourceLocation): void {
    const start = this.offset;
    while (this.isIdentifierPart(this.peek())) this.advance();
    this.tokens.push({
      type: "IDENTIFIER",
      lexeme: this.source.slice(start, this.offset),
      location,
    });
  }

  private scanString(location: SourceLocation): void {
    const quote = this.advance();
    const start = this.offset - 1;
    let value = "";

    while (!this.atEnd() && this.peek() !== quote) {
      const char = this.advance();
      if (char === "\n") {
        throw this.syntax("Strings cannot span lines; use \\n instead.", location);
      }
      if (char !== "\\") {
        value += char;
        continue;
      }

      if (this.atEnd()) break;
      const escaped = this.advance();
      const escapes: Record<string, string> = {
        n: "\n",
        r: "\r",
        t: "\t",
        "\\": "\\",
        '"': '"',
        "'": "'",
      };
      value += escapes[escaped] ?? escaped;
    }

    if (this.atEnd()) {
      throw this.syntax("Unterminated string.", location);
    }

    this.advance();
    this.tokens.push({
      type: "STRING",
      lexeme: this.source.slice(start, this.offset),
      literal: value,
      location,
    });
  }

  private scanSymbol(location: SourceLocation): void {
    const twoCharacters = this.source.slice(this.offset, this.offset + 2);
    const doubleSymbols = ["==", "!=", "<=", ">=", "+=", "-=", "*=", "/=", "%=", "&&", "||"];
    if (doubleSymbols.includes(twoCharacters)) {
      this.advanceText(twoCharacters);
      this.tokens.push({ type: "SYMBOL", lexeme: twoCharacters, location });
      return;
    }

    const character = this.peek();
    if (";{},()+-*/%<>=!".includes(character)) {
      this.advance();
      this.tokens.push({ type: "SYMBOL", lexeme: character, location });
      return;
    }

    throw this.syntax(`Unexpected character '${character}'.`, location);
  }

  private skipIgnored(): void {
    let skipped = true;
    while (skipped && !this.atEnd()) {
      skipped = false;
      while (/\s/.test(this.peek())) {
        this.advance();
        skipped = true;
      }

      if (this.peek() === "/" && this.peek(1) === "/") {
        while (!this.atEnd() && this.peek() !== "\n") this.advance();
        skipped = true;
      } else if (this.peek() === "/" && this.peek(1) === "*") {
        const location = this.location();
        this.advanceText("/*");
        while (!this.atEnd() && !(this.peek() === "*" && this.peek(1) === "/")) {
          this.advance();
        }
        if (this.atEnd()) throw this.syntax("Unterminated block comment.", location);
        this.advanceText("*/");
        skipped = true;
      }
    }
  }

  private advance(): string {
    const character = this.source[this.offset] ?? "\0";
    this.offset += 1;
    if (character === "\n") {
      this.line += 1;
      this.column = 1;
    } else {
      this.column += 1;
    }
    return character;
  }

  private advanceText(text: string): void {
    for (let index = 0; index < text.length; index += 1) this.advance();
  }

  private peek(distance = 0): string {
    return this.source[this.offset + distance] ?? "\0";
  }

  private atEnd(): boolean {
    return this.offset >= this.source.length;
  }

  private location(): SourceLocation {
    return { line: this.line, column: this.column };
  }

  private isDigit(character: string): boolean {
    return character >= "0" && character <= "9";
  }

  private isIdentifierStart(character: string): boolean {
    return /[A-Za-z_]/.test(character);
  }

  private isIdentifierPart(character: string): boolean {
    return /[A-Za-z0-9_]/.test(character);
  }

  private syntax(message: string, location: SourceLocation): NoCapError {
    return new NoCapError("SyntaxError", message, location, this.filename);
  }
}

export type Expression =
  | { readonly kind: "Literal"; readonly value: RuntimeValue; readonly location: SourceLocation }
  | { readonly kind: "Identifier"; readonly name: string; readonly location: SourceLocation }
  | { readonly kind: "Call"; readonly name: string; readonly arguments: readonly Expression[]; readonly location: SourceLocation }
  | { readonly kind: "Unary"; readonly operator: string; readonly operand: Expression; readonly location: SourceLocation }
  | { readonly kind: "Binary"; readonly left: Expression; readonly operator: string; readonly right: Expression; readonly location: SourceLocation }
  | { readonly kind: "Assignment"; readonly name: string; readonly operator: string; readonly value: Expression; readonly location: SourceLocation };

export type Statement =
  | { readonly kind: "Declaration"; readonly name: string; readonly initializer: Expression; readonly location: SourceLocation }
  | { readonly kind: "Print"; readonly values: readonly Expression[]; readonly location: SourceLocation }
  | { readonly kind: "Expression"; readonly expression: Expression; readonly location: SourceLocation }
  | { readonly kind: "Block"; readonly body: readonly Statement[]; readonly location: SourceLocation }
  | { readonly kind: "If"; readonly test: Expression; readonly consequent: Statement; readonly alternate: Statement | null; readonly location: SourceLocation }
  | { readonly kind: "While"; readonly test: Expression; readonly body: Statement; readonly location: SourceLocation }
  | { readonly kind: "Continue"; readonly location: SourceLocation }
  | { readonly kind: "Break"; readonly location: SourceLocation }
  | { readonly kind: "Function"; readonly name: string; readonly parameters: readonly string[]; readonly body: Extract<Statement, { kind: "Block" }>; readonly location: SourceLocation }
  | { readonly kind: "Return"; readonly value: Expression; readonly location: SourceLocation }
  | { readonly kind: "Throw"; readonly value: Expression; readonly location: SourceLocation }
  | { readonly kind: "Try"; readonly body: Statement; readonly errorName: string; readonly handler: Statement; readonly location: SourceLocation };

export interface Program {
  readonly kind: "Program";
  readonly body: readonly Statement[];
  readonly location: SourceLocation;
}

class Parser {
  private current = 0;
  private loopDepth = 0;
  private functionDepth = 0;

  constructor(
    private readonly tokens: readonly Token[],
    private readonly filename: string,
  ) {}

  parse(): Program {
    const start = this.consumeType("PROGRAM_START", "Every program must start with 'yo chat'.");
    const body: Statement[] = [];
    while (!this.checkType("PROGRAM_END") && !this.atEnd()) {
      body.push(this.statement());
    }
    this.consumeType("PROGRAM_END", "Every program must end with 'aight, touch grass'.");
    this.consumeType("EOF", "Nothing may appear after 'aight, touch grass'.");
    return { kind: "Program", body, location: start.location };
  }

  private statement(): Statement {
    if (this.matchType("FUNCTION")) return this.functionStatement(this.previous());
    if (this.matchType("RETURN")) return this.returnStatement(this.previous());
    if (this.matchType("DECLARE")) return this.declaration(this.previous());
    if (this.matchType("PRINT")) return this.printStatement(this.previous());
    if (this.matchType("IF")) return this.ifStatement(this.previous());
    if (this.matchType("WHILE")) return this.whileStatement(this.previous());
    if (this.matchType("CONTINUE")) return this.continueStatement(this.previous());
    if (this.matchType("BREAK")) return this.breakStatement(this.previous());
    if (this.matchType("THROW")) return this.throwStatement(this.previous());
    if (this.matchType("TRY")) return this.tryStatement(this.previous());
    if (this.matchSymbol("{")) return this.block(this.previous());
    return this.expressionStatement();
  }

  private functionStatement(keyword: Token): Statement {
    const name = this.consumeType("IDENTIFIER", "Expected a function name after 'cook'.");
    this.consumeSymbol("(", "Expected '(' after the function name.");
    const parameters: string[] = [];
    if (!this.checkSymbol(")")) {
      do {
        const parameter = this.consumeType("IDENTIFIER", "Expected a parameter name.");
        if (parameters.includes(parameter.lexeme)) {
          throw this.error(parameter, `Duplicate parameter '${parameter.lexeme}'.`);
        }
        parameters.push(parameter.lexeme);
      } while (this.matchSymbol(","));
    }
    this.consumeSymbol(")", "Expected ')' after the parameters.");

    const previousLoopDepth = this.loopDepth;
    this.loopDepth = 0;
    this.functionDepth += 1;
    try {
      const body = this.requiredBlock("Expected '{' before the function body.");
      return {
        kind: "Function",
        name: name.lexeme,
        parameters,
        body: body as Extract<Statement, { kind: "Block" }>,
        location: keyword.location,
      };
    } finally {
      this.functionDepth -= 1;
      this.loopDepth = previousLoopDepth;
    }
  }

  private returnStatement(keyword: Token): Statement {
    if (this.functionDepth === 0) throw this.error(keyword, "'serve' only works inside a function.");
    const value = this.expression();
    this.consumeSemicolon();
    return { kind: "Return", value, location: keyword.location };
  }

  private declaration(keyword: Token): Statement {
    const name = this.consumeType("IDENTIFIER", "Expected a name after 'soft launch'.");
    this.consumeSymbol("=", "Expected '=' after the variable name.");
    const initializer = this.expression();
    this.consumeSemicolon();
    return { kind: "Declaration", name: name.lexeme, initializer, location: keyword.location };
  }

  private printStatement(keyword: Token): Statement {
    if (this.checkSymbol(";")) throw this.error(this.peek(), "Expected a value after 'flex'.");
    const values = [this.expression()];
    while (this.matchSymbol(",")) values.push(this.expression());
    this.consumeSemicolon();
    return { kind: "Print", values, location: keyword.location };
  }

  private ifStatement(keyword: Token): Statement {
    this.consumeSymbol("(", "Expected '(' after 'vibe check'.");
    const test = this.expression();
    this.consumeSymbol(")", "Expected ')' after the vibe-check condition.");
    const consequent = this.requiredBlock("Expected '{' after the vibe-check condition.");
    const alternate = this.matchType("ELSE")
      ? this.requiredBlock("Expected '{' after 'not the vibe'.")
      : null;
    return { kind: "If", test, consequent, alternate, location: keyword.location };
  }

  private whileStatement(keyword: Token): Statement {
    this.consumeSymbol("(", "Expected '(' after 'keep cooking while'.");
    const test = this.expression();
    this.consumeSymbol(")", "Expected ')' after the loop condition.");
    this.loopDepth += 1;
    try {
      const body = this.requiredBlock("Expected '{' after the loop condition.");
      return { kind: "While", test, body, location: keyword.location };
    } finally {
      this.loopDepth -= 1;
    }
  }

  private continueStatement(keyword: Token): Statement {
    if (this.loopDepth === 0) throw this.error(keyword, "'ghosting' only works inside a loop.");
    this.consumeSemicolon();
    return { kind: "Continue", location: keyword.location };
  }

  private breakStatement(keyword: Token): Statement {
    if (this.loopDepth === 0) throw this.error(keyword, "'cooked' only works inside a loop.");
    this.consumeSemicolon();
    return { kind: "Break", location: keyword.location };
  }

  private throwStatement(keyword: Token): Statement {
    const value = this.expression();
    this.consumeSemicolon();
    return { kind: "Throw", value, location: keyword.location };
  }

  private tryStatement(keyword: Token): Statement {
    const body = this.requiredBlock("Expected '{' after 'try this'.");
    this.consumeType("CATCH", "Expected 'caught in 4K' after the protected block.");
    this.consumeSymbol("(", "Expected '(' after 'caught in 4K'.");
    const name = this.consumeType("IDENTIFIER", "Expected an error name.");
    this.consumeSymbol(")", "Expected ')' after the error name.");
    const handler = this.requiredBlock("Expected '{' before the error handler.");
    return {
      kind: "Try",
      body,
      errorName: name.lexeme,
      handler,
      location: keyword.location,
    };
  }

  private requiredBlock(message: string): Statement {
    const brace = this.consumeSymbol("{", message);
    return this.block(brace);
  }

  private block(brace: Token): Statement {
    const body: Statement[] = [];
    while (!this.checkSymbol("}") && !this.atEnd()) {
      if (this.checkType("PROGRAM_END")) {
        throw this.error(this.peek(), "Expected '}' before the program ended.");
      }
      body.push(this.statement());
    }
    this.consumeSymbol("}", "Expected '}' after the block.");
    return { kind: "Block", body, location: brace.location };
  }

  private expressionStatement(): Statement {
    const expression = this.expression();
    this.consumeSemicolon();
    return { kind: "Expression", expression, location: expression.location };
  }

  private expression(): Expression {
    return this.assignment();
  }

  private assignment(): Expression {
    const left = this.logicalOr();
    if (!this.matchAnySymbol("=", "+=", "-=", "*=", "/=", "%=")) return left;

    const operator = this.previous();
    const value = this.assignment();
    if (left.kind !== "Identifier") {
      throw this.error(operator, "Only a variable can be assigned a value.");
    }
    return {
      kind: "Assignment",
      name: left.name,
      operator: operator.lexeme,
      value,
      location: left.location,
    };
  }

  private logicalOr(): Expression {
    return this.leftAssociative(() => this.logicalAnd(), "||");
  }

  private logicalAnd(): Expression {
    return this.leftAssociative(() => this.equality(), "&&");
  }

  private equality(): Expression {
    return this.leftAssociative(() => this.comparison(), "==", "!=");
  }

  private comparison(): Expression {
    return this.leftAssociative(() => this.term(), "<", "<=", ">", ">=");
  }

  private term(): Expression {
    return this.leftAssociative(() => this.factor(), "+", "-");
  }

  private factor(): Expression {
    return this.leftAssociative(() => this.unary(), "*", "/", "%");
  }

  private leftAssociative(next: () => Expression, ...operators: readonly string[]): Expression {
    let expression = next();
    while (this.matchAnySymbol(...operators)) {
      const operator = this.previous();
      expression = {
        kind: "Binary",
        left: expression,
        operator: operator.lexeme,
        right: next(),
        location: operator.location,
      };
    }
    return expression;
  }

  private unary(): Expression {
    if (this.matchAnySymbol("!", "-", "+")) {
      const operator = this.previous();
      return {
        kind: "Unary",
        operator: operator.lexeme,
        operand: this.unary(),
        location: operator.location,
      };
    }
    return this.call();
  }

  private call(): Expression {
    let expression = this.primary();
    while (this.matchSymbol("(")) {
      if (expression.kind !== "Identifier") {
        throw this.error(this.previous(), "Only a named function can be called.");
      }
      const argumentsList: Expression[] = [];
      if (!this.checkSymbol(")")) {
        do {
          argumentsList.push(this.expression());
        } while (this.matchSymbol(","));
      }
      this.consumeSymbol(")", "Expected ')' after the arguments.");
      expression = {
        kind: "Call",
        name: expression.name,
        arguments: argumentsList,
        location: expression.location,
      };
    }
    return expression;
  }

  private primary(): Expression {
    if (this.matchType("NUMBER", "STRING")) {
      const token = this.previous();
      return { kind: "Literal", value: token.literal ?? null, location: token.location };
    }
    if (this.matchType("TRUE")) {
      return { kind: "Literal", value: true, location: this.previous().location };
    }
    if (this.matchType("FALSE")) {
      return { kind: "Literal", value: false, location: this.previous().location };
    }
    if (this.matchType("NULL")) {
      return { kind: "Literal", value: null, location: this.previous().location };
    }
    if (this.matchType("IDENTIFIER")) {
      const token = this.previous();
      return { kind: "Identifier", name: token.lexeme, location: token.location };
    }
    if (this.matchSymbol("(")) {
      const expression = this.expression();
      this.consumeSymbol(")", "Expected ')' after the expression.");
      return expression;
    }
    throw this.error(this.peek(), "Expected an expression.");
  }

  private consumeSemicolon(): void {
    this.consumeSymbol(";", "Expected ';' after the statement.");
  }

  private matchType(...types: readonly TokenType[]): boolean {
    if (!types.some((type) => this.checkType(type))) return false;
    this.advance();
    return true;
  }

  private matchSymbol(symbol: string): boolean {
    if (!this.checkSymbol(symbol)) return false;
    this.advance();
    return true;
  }

  private matchAnySymbol(...symbols: readonly string[]): boolean {
    if (!symbols.some((symbol) => this.checkSymbol(symbol))) return false;
    this.advance();
    return true;
  }

  private consumeType(type: TokenType, message: string): Token {
    if (this.checkType(type)) return this.advance();
    throw this.error(this.peek(), message);
  }

  private consumeSymbol(symbol: string, message: string): Token {
    if (this.checkSymbol(symbol)) return this.advance();
    throw this.error(this.peek(), message);
  }

  private checkType(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private checkSymbol(symbol: string): boolean {
    const token = this.peek();
    return token.type === "SYMBOL" && token.lexeme === symbol;
  }

  private advance(): Token {
    if (!this.atEnd()) this.current += 1;
    return this.previous();
  }

  private atEnd(): boolean {
    return this.peek().type === "EOF";
  }

  private peek(): Token {
    return this.tokens[this.current] ?? this.tokens[this.tokens.length - 1]!;
  }

  private previous(): Token {
    return this.tokens[Math.max(0, this.current - 1)]!;
  }

  private error(token: Token, message: string): NoCapError {
    return new NoCapError("SyntaxError", message, token.location, this.filename);
  }
}

interface FunctionValue {
  readonly kind: "FunctionValue";
  readonly name: string;
  readonly parameters: readonly string[];
  readonly body: Extract<Statement, { kind: "Block" }>;
  readonly closure: Environment;
}

type StoredValue = RuntimeValue | FunctionValue;

function isFunction(value: StoredValue): value is FunctionValue {
  return typeof value === "object" && value !== null && "kind" in value && value.kind === "FunctionValue";
}

class Environment {
  private readonly values = new Map<string, StoredValue>();

  constructor(private readonly parent: Environment | null = null) {}

  declare(name: string, value: StoredValue, location: SourceLocation, filename: string): void {
    if (this.values.has(name)) {
      throw new NoCapError("RuntimeError", `Variable '${name}' was already soft launched in this scope.`, location, filename);
    }
    this.values.set(name, value);
  }

  get(name: string, location: SourceLocation, filename: string): StoredValue {
    if (this.values.has(name)) return this.values.get(name)!;
    if (this.parent) return this.parent.get(name, location, filename);
    throw new NoCapError("RuntimeError", `Variable '${name}' has not been soft launched.`, location, filename);
  }

  assign(name: string, value: RuntimeValue, location: SourceLocation, filename: string): void {
    if (this.values.has(name)) {
      if (isFunction(this.values.get(name)!)) {
        throw new NoCapError("RuntimeError", `Function '${name}' cannot be reassigned.`, location, filename);
      }
      this.values.set(name, value);
      return;
    }
    if (this.parent) {
      this.parent.assign(name, value, location, filename);
      return;
    }
    throw new NoCapError("RuntimeError", `Variable '${name}' has not been soft launched.`, location, filename);
  }

  snapshot(): ReadonlyMap<string, RuntimeValue> {
    const snapshot = new Map<string, RuntimeValue>();
    for (const [name, value] of this.values) {
      if (!isFunction(value)) snapshot.set(name, value);
    }
    return snapshot;
  }
}

const BREAK_SIGNAL = Symbol("break");
const CONTINUE_SIGNAL = Symbol("continue");

class ReturnSignal {
  constructor(readonly value: RuntimeValue) {}
}

export interface RunOptions {
  readonly filename?: string;
  readonly maxSteps?: number;
  readonly stdout?: (text: string) => void;
}

export interface RunResult {
  readonly output: readonly string[];
  readonly variables: ReadonlyMap<string, RuntimeValue>;
  readonly steps: number;
}

class Interpreter {
  private readonly global = new Environment();
  private environment = this.global;
  private readonly output: string[] = [];
  private steps = 0;
  private callDepth = 0;

  constructor(
    private readonly filename: string,
    private readonly maxSteps: number,
    private readonly stdout: (text: string) => void,
  ) {}

  execute(program: Program): RunResult {
    for (const statement of program.body) this.executeStatement(statement);
    return {
      output: this.output,
      variables: this.global.snapshot(),
      steps: this.steps,
    };
  }

  private executeStatement(statement: Statement): void {
    this.tick(statement.location);
    switch (statement.kind) {
      case "Declaration":
        this.environment.declare(
          statement.name,
          this.evaluate(statement.initializer),
          statement.location,
          this.filename,
        );
        return;
      case "Print": {
        const text = statement.values.map((value) => this.format(this.evaluate(value))).join(" ");
        this.output.push(text);
        this.stdout(text);
        return;
      }
      case "Expression":
        this.evaluate(statement.expression);
        return;
      case "Block":
        this.executeBlock(statement.body, new Environment(this.environment));
        return;
      case "If":
        if (this.boolean(this.evaluate(statement.test), statement.test.location)) {
          this.executeStatement(statement.consequent);
        } else if (statement.alternate) {
          this.executeStatement(statement.alternate);
        }
        return;
      case "While":
        this.executeWhile(statement);
        return;
      case "Continue":
        throw CONTINUE_SIGNAL;
      case "Break":
        throw BREAK_SIGNAL;
      case "Function":
        this.environment.declare(
          statement.name,
          {
            kind: "FunctionValue",
            name: statement.name,
            parameters: statement.parameters,
            body: statement.body,
            closure: this.environment,
          },
          statement.location,
          this.filename,
        );
        return;
      case "Return":
        throw new ReturnSignal(this.evaluate(statement.value));
      case "Throw":
        throw this.runtime(this.format(this.evaluate(statement.value)), statement.location);
      case "Try":
        this.executeTry(statement);
        return;
    }
  }

  private executeBlock(statements: readonly Statement[], environment: Environment): void {
    const previous = this.environment;
    this.environment = environment;
    try {
      for (const statement of statements) this.executeStatement(statement);
    } finally {
      this.environment = previous;
    }
  }

  private executeWhile(statement: Extract<Statement, { kind: "While" }>): void {
    while (this.boolean(this.evaluate(statement.test), statement.test.location)) {
      this.tick(statement.location);
      try {
        this.executeStatement(statement.body);
      } catch (error) {
        if (error === CONTINUE_SIGNAL) continue;
        if (error === BREAK_SIGNAL) break;
        throw error;
      }
    }
  }

  private executeTry(statement: Extract<Statement, { kind: "Try" }>): void {
    try {
      this.executeStatement(statement.body);
    } catch (error) {
      if (!(error instanceof NoCapError) || error.kind !== "RuntimeError") throw error;
      const handlerEnvironment = new Environment(this.environment);
      handlerEnvironment.declare(statement.errorName, error.message, statement.location, this.filename);
      const previous = this.environment;
      this.environment = handlerEnvironment;
      try {
        this.executeStatement(statement.handler);
      } finally {
        this.environment = previous;
      }
    }
  }

  private evaluate(expression: Expression): RuntimeValue {
    switch (expression.kind) {
      case "Literal":
        return expression.value;
      case "Identifier":
        return this.variable(expression.name, expression.location);
      case "Call":
        return this.evaluateCall(expression);
      case "Unary":
        return this.evaluateUnary(expression);
      case "Binary":
        return this.evaluateBinary(expression);
      case "Assignment":
        return this.evaluateAssignment(expression);
    }
  }

  private evaluateCall(expression: Extract<Expression, { kind: "Call" }>): RuntimeValue {
    const value = this.environment.get(expression.name, expression.location, this.filename);
    if (!isFunction(value)) {
      throw this.runtime(`'${expression.name}' is not a function.`, expression.location);
    }
    if (expression.arguments.length !== value.parameters.length) {
      throw this.runtime(
        `Function '${value.name}' expects ${value.parameters.length} argument(s), but got ${expression.arguments.length}.`,
        expression.location,
      );
    }
    if (this.callDepth >= 256) {
      throw this.runtime("Function calls exceeded the recursion safety limit.", expression.location);
    }

    const argumentValues = expression.arguments.map((argument) => this.evaluate(argument));
    const callEnvironment = new Environment(value.closure);
    for (let index = 0; index < value.parameters.length; index += 1) {
      callEnvironment.declare(value.parameters[index]!, argumentValues[index]!, expression.location, this.filename);
    }

    this.callDepth += 1;
    try {
      this.executeBlock(value.body.body, callEnvironment);
    } catch (error) {
      if (error instanceof ReturnSignal) return error.value;
      throw error;
    } finally {
      this.callDepth -= 1;
    }
    return null;
  }

  private evaluateUnary(expression: Extract<Expression, { kind: "Unary" }>): RuntimeValue {
    const value = this.evaluate(expression.operand);
    if (expression.operator === "!") return !this.boolean(value, expression.location);
    const number = this.number(value, expression.location);
    return expression.operator === "-" ? -number : number;
  }

  private evaluateBinary(expression: Extract<Expression, { kind: "Binary" }>): RuntimeValue {
    const left = this.evaluate(expression.left);

    if (expression.operator === "&&") {
      if (!this.boolean(left, expression.left.location)) return false;
      return this.boolean(this.evaluate(expression.right), expression.right.location);
    }
    if (expression.operator === "||") {
      if (this.boolean(left, expression.left.location)) return true;
      return this.boolean(this.evaluate(expression.right), expression.right.location);
    }

    const right = this.evaluate(expression.right);
    switch (expression.operator) {
      case "==":
        return Object.is(left, right);
      case "!=":
        return !Object.is(left, right);
      case "+":
        if (typeof left === "number" && typeof right === "number") {
          return this.finite(left + right, expression.location);
        }
        if (typeof left === "string" && typeof right === "string") return left + right;
        throw this.runtime("'+' needs two numbers or two strings.", expression.location);
      case "-":
        return this.finite(this.number(left, expression.location) - this.number(right, expression.location), expression.location);
      case "*":
        return this.finite(this.number(left, expression.location) * this.number(right, expression.location), expression.location);
      case "/": {
        const divisor = this.number(right, expression.location);
        if (divisor === 0) throw this.runtime("Division by zero.", expression.location);
        return this.finite(this.number(left, expression.location) / divisor, expression.location);
      }
      case "%": {
        const divisor = this.number(right, expression.location);
        if (divisor === 0) throw this.runtime("Division by zero.", expression.location);
        return this.finite(this.number(left, expression.location) % divisor, expression.location);
      }
      case "<":
      case "<=":
      case ">":
      case ">=":
        return this.compare(left, right, expression.operator, expression.location);
      default:
        throw this.runtime(`Unknown operator '${expression.operator}'.`, expression.location);
    }
  }

  private evaluateAssignment(expression: Extract<Expression, { kind: "Assignment" }>): RuntimeValue {
    const right = this.evaluate(expression.value);
    let value = right;
    if (expression.operator !== "=") {
      const left = this.variable(expression.name, expression.location);
      value = this.applyCompound(left, right, expression.operator, expression.location);
    }
    this.environment.assign(expression.name, value, expression.location, this.filename);
    return value;
  }

  private variable(name: string, location: SourceLocation): RuntimeValue {
    const value = this.environment.get(name, location, this.filename);
    if (isFunction(value)) {
      throw this.runtime(`Function '${name}' must be called with parentheses.`, location);
    }
    return value;
  }

  private applyCompound(
    left: RuntimeValue,
    right: RuntimeValue,
    operator: string,
    location: SourceLocation,
  ): RuntimeValue {
    const binaryOperator = operator.slice(0, -1);
    const expression: Extract<Expression, { kind: "Binary" }> = {
      kind: "Binary",
      left: { kind: "Literal", value: left, location },
      operator: binaryOperator,
      right: { kind: "Literal", value: right, location },
      location,
    };
    return this.evaluateBinary(expression);
  }

  private compare(left: RuntimeValue, right: RuntimeValue, operator: string, location: SourceLocation): boolean {
    if (typeof left !== typeof right || (typeof left !== "number" && typeof left !== "string")) {
      throw this.runtime("Comparisons need two numbers or two strings of the same type.", location);
    }
    if (typeof left === "number" && typeof right === "number") {
      if (operator === "<") return left < right;
      if (operator === "<=") return left <= right;
      if (operator === ">") return left > right;
      return left >= right;
    }
    const leftString = left as string;
    const rightString = right as string;
    if (operator === "<") return leftString < rightString;
    if (operator === "<=") return leftString <= rightString;
    if (operator === ">") return leftString > rightString;
    return leftString >= rightString;
  }

  private boolean(value: RuntimeValue, location: SourceLocation): boolean {
    if (typeof value !== "boolean") {
      throw this.runtime("A condition must evaluate to 'no cap' or 'delulu'.", location);
    }
    return value;
  }

  private number(value: RuntimeValue, location: SourceLocation): number {
    if (typeof value !== "number") throw this.runtime("This operation needs a number.", location);
    return value;
  }

  private finite(value: number, location: SourceLocation): number {
    if (!Number.isFinite(value)) throw this.runtime("The number went out of range.", location);
    return value;
  }

  private format(value: RuntimeValue): string {
    if (value === null) return "ghosted";
    if (value === true) return "no cap";
    if (value === false) return "delulu";
    return String(value);
  }

  private tick(location: SourceLocation): void {
    this.steps += 1;
    if (this.steps > this.maxSteps) {
      throw this.runtime(`Execution exceeded the ${this.maxSteps.toLocaleString()}-step safety limit.`, location);
    }
  }

  private runtime(message: string, location: SourceLocation): NoCapError {
    return new NoCapError("RuntimeError", message, location, this.filename);
  }
}

export function tokenize(source: string, filename = "<source>"): readonly Token[] {
  return new Lexer(source, filename).scan();
}

export function parse(source: string, filename = "<source>"): Program {
  return new Parser(tokenize(source, filename), filename).parse();
}

export function run(source: string, options: RunOptions = {}): RunResult {
  const filename = options.filename ?? "<source>";
  const maxSteps = options.maxSteps ?? 1_000_000;
  if (!Number.isSafeInteger(maxSteps) || maxSteps <= 0) {
    throw new TypeError("maxSteps must be a positive safe integer.");
  }
  const stdout = options.stdout ?? ((text: string) => console.log(text));
  return new Interpreter(filename, maxSteps, stdout).execute(parse(source, filename));
}

export const interpret = run;
