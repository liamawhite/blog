---
title: '[Concurrency by Composition] Designing a Web Crawler'
weight: 30
---

{{% section %}}


### Designing a web indexer

- Seed Initial URLs
- Retrieve the HTML for a page.
- Parsing it for links.
- Record and search pages we have found.

{{% note %}}

So let's go through an abstract example.

See bullets.

What we can do here is take each of these things and model it as a separate sequential process.

{{% /note %}}

---

```mermaid
graph TD
    A[Seed Initial URLs]
    B[Retrieve HTML]
    C[Parse for Links]
    D[Record URL]
```

{{% note %}}

It's easy to write several smaller sequential programs that do these things.

We can then take them and compose them however we like.

{{% /note %}}

---

```mermaid
graph LR
    A[Seed Initial URLs] --> B[Retrieve HTML]
    B --> C[Parse for Links]
    C --> B
    C --> D[Record URL]
```

{{% note %}}

For example, we could have the parser send the links it finds to the HTML retriever process.

Each of these arrows represents message passing.

{{% /note %}}

---

```mermaid
graph LR
    A[Seed Initial URLs] --> B[Record URL]
    B --> C[Retrieve HTML]
    C --> D[Parse for Links]
    D --> B
```

{{% note %}}

Or, we could have the URL recorder be responsible for sending new URLs to the retreiever.

Doing it this way enables us to avoid visiting pages twice.

{{% /note %}}

---

Good concurrent design looks a lot like the Unix Philosophy.

{{% note %}}

We decompose the problem into simple modular chunks with strong interfaces.

This enables us to easily reason about each of the modules/processes individually.

We then compose these into a pipeline to provide the concurrency.

{{% /note %}}

---

Good concurrent design decouples us from parallelism

{{% note %}}

Notice as well that I haven't mentioned parallelism at any point.

The pipelines we discussed may be run across multiple CPU cores but there's no reason why it has to be.

In fact, good concurrent design decouples us entirely from parallelism.

In go, we just let the scheduler decide what to run and when.

Good concurrent design provides isolation, and isolation enables us horizontally scale (in terms of number of go routines)

{{% /note %}}

{{% /section %}}