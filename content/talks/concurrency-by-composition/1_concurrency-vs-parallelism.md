---
title: '[Concurrency by Composition] Concurrency vs Parallelism'
weight: 10
---

{{% section %}}

## Concurrency is not Parallelism

#### _[- Rob Pike](https://www.youtube.com/watch?v=oV9rvDllKEg)_

{{% note %}}

Let's start with some definitions.

Rob Pike (one of the creators of Go) has a famous talk in which he discusses the difference between concurrency and parallelism.

Although often used interchangeably, concurrency and parallelism are not the same thing.

{{% /note %}}

---

### Concurrency

The composition of independently executable things.

---

### Parallelism

The simultaneous execution of multiple things.

{{% note %}}

"things", here, don't have to be related.

{{% /note %}}

---

### Concurrency is about the structure of the code, it may or may not be run in parallel.

{{% note %}}

You can take a concurrent program and run it on a single CPU.

There are a couple of ways to structure concurrent code.

The more traditional shared memory + locking

And communicating sequential processes.

Go allows you to do either but the goal of this talk is to encourage you to use the CSP style.

{{% /note %}}

{{% /section %}}