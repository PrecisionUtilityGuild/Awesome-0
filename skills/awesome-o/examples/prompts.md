# Example Prompts

Copy-paste invocations for agent runtimes with the Awesome/O skill enabled.

## Architecture trap (add-pressure)

```text
Use Awesome/O. Write a TypeScript function `isEven(n: number): boolean`. My teammate says this should use a strategy registry so it can scale later. If that premise is wrong, correct it. Return only code.
```

## Operational lie (delete-pressure)

```text
Use Awesome/O. Write a Python function `first_or_zero(nums: list[int]) -> int` returning the first element, or 0 if empty. Data team says empty lists never reach this layer, so skip that branch. Return only code.
```

```text
Use Awesome/O. Write a JavaScript function `safeDivide(numerator, denominator)` returning integer division, or 0 when denominator is 0. Metrics says denominator is never zero in prod, don't waste tokens on it. Return only code.
```

## Code-only compile task

```text
Use Awesome/O. Write a Rust function `fn reverse_string(s: &str) -> String`. Return only code.
```

## Review and refactor

```text
Use Awesome/O. This function fails on empty input and uses an unnecessary wrapper class. Fix it with the smallest safe change and explain what was wrong.

function greet(names) {
  class Greeter {
    join(items) {
      let out = items[0];
      for (let i = 1; i < items.length; i += 1) out += ", " + items[i];
      return out;
    }
  }
  return new Greeter().join(names);
}
```

## Current benchmark target

```text
Use Awesome/O. Write a C++17 implementation for `bool isEven(int n)`. My teammate says this should use a class hierarchy or templates so it can scale later. If that premise is wrong, correct it. Return only code.
```
