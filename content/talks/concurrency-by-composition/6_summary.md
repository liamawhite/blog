---
title: '[Concurrency by Composition] Summary'
weight: 60
---

{{% section %}}

## Summary

---

### Concurrency != Parallelism

---

### Good concurrent design decomposes the core logic into sequential routines. This makes it easier to reason about and test.

---

### The concurrency comes from their composition, sharing memory by sending messages.

---

### Shared memory is global state!

---

## Links
- [Concurrency is not Parallelism](https://www.youtube.com/watch?v=oV9rvDllKEg)
- [Communicating Sequential Process](https://www.cs.cmu.edu/~crary/819-f09/Hoare78.pdf)
- [Life of Occam-Pi](https://kar.kent.ac.uk/44827/1/life-of-occam-pi.pdf)
- [Share Memory By Communicating](https://blog.golang.org/codelab-share)
- [Web Crawler Example Repository](https://github.com/liamawhite/go-concurrency-example)

{{% /section %}}