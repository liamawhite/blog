---
title: '[Concurrency by Composition] CSP and the Unix Philosophy'
weight: 30
---

{{% section %}}

### The Unix Philosophy

Simplicity, modularity and composition.

{{% note %}}

Before we discuss CSP in detail, let's take a step back and talk about the unix philosophy.

The Unix philosophy is a set of heuristics for structuring maintainable programs and code.

Go's langauge design pushes you towards writing code in the style of the unix philosophy

I have listed a few of the most relevant ones to Go concurrency here, but there are many more.

Simplicity
- Design for simplicity; add complexity only where you must.

Modularity
- Write simple parts connected by clean interfaces.
- This is also sometimes discussed as programs should do one thing.

Composition
- Design programs to be connected to other programs.
- In Unix-like systems this is obviously represented by the way we pipe programs into one another.

If you're familiar with go, you'll notice that the language is designed to encourage some of these principles.
- The obvious example being struct composition.
- A less obvious example are the concurrency primitives, which we will discuss!

The fact that go is designed around these principles is unsurprising...
- One of the three creators is Ken Thompson who designed and implemented the original Unix operating system.
- And another is Rob Pike who was on the Unix team at Bell Labs.

{{% /note %}}

---

### Communicating Sequential Processes

{{% note %}}

Go's concurrency primitives (and a couple of other languages) are heavily influenced by the CSP paper.

I imagine one of the reasons is that CSP lays out a concurrency model very much in the spirit of the Unix philosophy.

At a high level, CSP is about two things.

- Isolated sequential programs

- That communicate via message passing.

{{% /note %}}

---

### Sequential processes encourage understandable code.

{{% note %}}

This is particularly relevant in some of the domains we operate in.

The domain of translating abstract application networking into Envoy configuration is quite complicated.

So it is important from a correctness point of view that Istio and XCP code is understandable.

The reason is that in simple domains, we are able to reason about the concurrency and domain simultaneously. 

The problem comes when we start off with a simple domain, so just use shared memory.

Our program grows naturally but we never reconsider the concurrency model so end up with a tightly coupled ball of mud.

In complicated domains its harder to reason about the concurrency and domain at the same time.

By decomposing it into smaller chunks that can be composed back together. It allows us to reason about (and test) the smaller chunks individually.

{{% /note %}}

---

### Do not communicate by sharing memory; instead, share memory by communicating.

{{% note %}}

There is a well known Go aphorism.

Do not communicate by sharing memory; instead, share memory by communicating.

This is the C of CSP.

Messaging is our primary weapon for avoiding global state.

And really a concurrency specific framing of the previous Alan Kay quote.

By sending immutable messages between processes we design away data races and corruption without the use of low-level primitives such as locks.

It also allows us to model our code closer to the real world thing it is modelling, and simplify our implementations.

{{% /note %}}

---

```go
func Poller(in, out chan *Resource) {
    for r := range in {
        // Polling logic

        // send the processed Resource to out
        out <- r
    }
}
```

#### _The Go Blog - [Share Memory By Communicating](https://blog.golang.org/codelab-share)_

{{% note %}}

If we take the polling example I used earlier structured in a CSP style we have reduced the accidental complexity.

No complex locking and unlocking, all thats left are the important parts.

This routine is sequential, isolated and can be instantiated as many times as we like.

{{% /note %}}

{{% /section %}}