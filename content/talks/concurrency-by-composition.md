---
title: Concurrency by Composition
subtitle: Go, CSP and the Unix Philosphy
---

## Concurrency != Parallelism

#### _[Rob Pike](https://www.youtube.com/watch?v=oV9rvDllKEg)_

=================== Notes ===================

Let's start with some definitions.

Rob Pike (one of the creators of Go) has a famous talk in which he discusses the difference between concurrency and parallelism.

Although often used interchangeably, concurrency and parallelism are not the same thing.

--

### Concurrency

The composition of independently executable things.

--

### Parallelism

The simultaneous execution of multiple things.

=================== Notes ===================

"things", here, don't have to be related.

--

### Concurrency is about the structure of the code, it may or may not be run in parallel.

=================== Notes ===================

You can take a concurrent program and run it on a single CPU.

There are a couple of ways to structure concurrent code.

The more traditional shared memory + locking

And communicating sequential processes.

Go allows you to do either but the goal of this talk is to encourage you to use the CSP style.

---

![](/images/csp-acm.png)
![](/images/csp.png)

=================== Notes ===================

In 1978, Tony Hoare wrote the Communicating Sequential Proccesses paper.

Its one of the most cited computer science paper.

The paper does a good job of laying out the model but less so as a critique of modern software patterns (mostly because it was written in 1978)

Instead, I'm going to use some quotes from a paper called The Life of Occam-Pi and we'll come back to the CSP model later with some go code.

--

![](/images/life-of-occam-pi.png)

=================== Notes ===================

Occam-pi is a language directly descended from CSP and is part of the same family tree as Go.

The language itself is mostly used in academia.

But this paper does a good job at critiquing the shared memory locking style of concurrency.

Side note, this paper opens with the of citations: Babbage's analytical engine, Russell's Principia Mathematica, Godel's Incompleteness Theorem, Church's Pi-Calculus and Turing's Computable Numbers.

This takes a certain level of confidence to pull off...

--

_"Concurrency is a powerful tool for simplifying the description of systems. Performance spins out from this, but is not the primary focus."_

=================== Notes ===================

Concurrency is about the design of the program not about performance.

Performance is a by-product of good concurrent design.

Again, we have this idea of concurrency being about good design and structure of the code.

--

_"Traditional approaches to concurrency (e.g. shared data and locks) conflict with some basic assumptions of, and our intuition for, sequential programming. They are, not surprisingly, very difficult to use."_

=================== Notes ===================

This is because we are forced to deal with low-level implementation details of the computer.

It's unlikely that Mutexes are really part of the core problem we are trying to model with our code.

They are a solution to the problem of shared memory.

They aren't fundamental to writing concurrent programs.

i.e. We have a leaky abstraction.

--

### Accidental vs Essential complexity

=================== Notes ===================

This is really accidental vs essential complexity

A mental model from Fred Brook's No Silver Bullet essay.

Essential complexity is core to the problem you're trying to solve.

Accidental complexity is complexity that developers make for themselves.

--

```go
func Poller(res *Resources) {
    for {
        // Get the least recently-polled Resource and mark it as being polled
        res.lock.Lock()
        var r *Resource
        for _, v := range res.data {
            if v.polling { continue }
            if r == nil || v.lastPolled < r.lastPolled { r = v }
        }
        if r != nil { r.polling = true }
        res.lock.Unlock()
        if r == nil { continue }

        // Actual polling logic!!!

        res.lock.Lock()
        r.polling = false
        r.lastPolled = time.Nanoseconds()
        res.lock.Unlock()
    }
}
```

#### _The Go Blog - [Share Memory By Communicating](https://blog.golang.org/codelab-share)_

=================== Notes ===================

This example is a program that polls a list of URLs using locks.

This doesn't even contain the polling logic, its purely defensive code to protext against races.

This is all accidental complexity from a leaky abrstraction.


--

### Shared memory and locking are just global state in disguise.

=================== Notes ===================

This is not actually in the paper, but I think its an important intuition.

It took me a while to actually internalise this.

We wouldn't use global state elsewhere so why do we use it here? 

---

### The Unix Philosophy

Simplicity, modularity and composition.

=================== Notes ===================

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

--

### Communicating Sequential Processes

=================== Notes ===================

Go's concurrency primitives (and a couple of other languages) are heavily influenced by the CSP paper.

I imagine one of the reasons is that CSP lays out a concurrency model very much in the spirit of the Unix philosophy.

At a high level, CSP is about two things.

- Isolated sequential programs

- That communicate via message passing.

--

### Sequential processes encourage understandable code.

=================== Notes ===================

This is particularly relevant in some of the domains we operate in.

The domain of translating abstract application networking into Envoy configuration is quite complicated.

So it is important from a correctness point of view that Istio and XCP code is understandable.

The reason is that in simple domains, we are able to reason about the concurrency and domain simultaneously. 

The problem comes when we start off with a simple domain, so just use shared memory.

Our program grows naturally but we never reconsider the concurrency model so end up with a tightly coupled ball of mud.

In complicated domains its harder to reason about the concurrency and domain at the same time.

By decomposing it into smaller chunks that can be composed back together. It allows us to reason about (and test) the smaller chunks individually.

--

### Do not communicate by sharing memory; instead, share memory by communicating.

=================== Notes ===================

There is a well known Go aphorism.

Do not communicate by sharing memory; instead, share memory by communicating.

This is the C of CSP.

Messaging is our primary weapon for avoiding global state.

And really a concurrency specific framing of the previous Alan Kay quote.

By sending immutable messages between processes we design away data races and corruption without the use of low-level primitives such as locks.

It also allows us to model our code closer to the real world thing it is modelling, and simplify our implementations.

--

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

=================== Notes ===================

If we take the polling example I used earlier structured in a CSP style we have reduced the accidental complexity.

No complex locking and unlocking, all thats left are the important parts.

This routine is sequential, isolated and can be instantiated as many times as we like.

---

### Building a web indexer

- Seed Initial URLs
- Retrieve the HTML for a page.
- Parsing it for links.
- Record and search pages we have found.

=================== Notes ===================

So let's go through an abstract example.

See bullets.

What we can do here is take each of these things and model it as a separate sequential process.

--

```mermaid
graph TD
    A[Seed Initial URLs]
    B[Retrieve HTML]
    C[Parse for Links]
    D[Record URL]
```

=================== Notes ===================

It's easy to write several smaller sequential programs that do these things.

We can then take them and compose them however we like.

--

```mermaid
graph LR
    A[Seed Initial URLs] --> B[Retrieve HTML]
    B --> C[Parse for Links]
    C --> B
    C --> D[Record URL]
```

=================== Notes ===================

For example, we could have the parser send the links it finds to the HTML retriever process.

Each of these arrows represents message passing.

--

```mermaid
graph LR
    A[Seed Initial URLs] --> B[Record URL]
    B --> C[Retrieve HTML]
    C --> D[Parse for Links]
    D --> B
```

=================== Notes ===================

Or, we could have the URL recorder be responsible for sending new URLs to the retreiever.

Doing it this way enables us to avoid visiting pages twice.

--

Good concurrent design looks a lot like the Unix Philosophy.

=================== Notes ===================

We decompose the problem into simple modular chunks with strong interfaces.

This enables us to easily reason about each of the modules/processes individually.

We then compose these into a pipeline to provide the concurrency.

--

Good concurrent design decouples us from parallelism

=================== Notes ===================

Notice as well that I haven't mentioned parallelism at any point.

The pipelines we discussed may be run across multiple CPU cores but there's no reason why it has to be.

In fact, good concurrent design decouples us entirely from parallelism.

In go, we just let the scheduler decide what to run and when.

Good concurrent design provides isolation, and isolation effectively enables us horizontally scale (in terms of number of go routines) 

---

### Communicating Sequential Go Routines

=================== Notes ===================

So let's look at how Go provides the primitives to model our code in this style.

Starting off with Dijkstra's parbegin.

--

```go [1,10|2|5-6|9]
func main() {
    var wg sync.WaitGroup

    for i:=0; i++; i<10 {
        wg.Add(1)
        go sequentialProcess(&wg)
    }

    wg.Wait()
}
```

_"A parallel command, based on Dijkstra's parbegin, specifies concurrent execution of its constituent sequential commands (processes)."_

=================== Notes ===================

The paper talks about Dijkstra's parbegin.

This is really the thread that creates the concurrent threads, waits for them to complete and then terminates.

CLICK THROUGH

--

_"[Concurrent processes] may not communicate with each other by updating global variables."_

=================== Notes ===================

Concurrent processes may not communicate with each other by updating global variables.

That a shared memory is global state by a different name and we should treat it like we do other global state, i.e. don't use it.

--

```go [2-7|2|4|6-7]
func main() {
    messages := make(chan string)

    go func() { messages <- "ping" }()

    msg := <-messages
    fmt.Println(msg)
}
```

_"Simple forms of input and output command are introduced. They are used for communication between concurrent processes."_

=================== Notes ===================

CLICK THROUGH!

--

```go [2]
func main() {
    messages := make(chan string)

    go func() { messages <- "ping" }()

    msg := <-messages
    fmt.Println(msg)
}
```

_"A simple pattern-matching feature [...] is used to discriminate the structure of an input message."_

=================== Notes ===================

In Go we have typed channels.

Here you can see the channel can only send and receive strings.

So the messages we are passing around are subject to the type checker.

--

```go [9-14]
func main() {
    c1 := make(chan string)
    c2 := make(chan string)

    go sendMessage(c1, "one")
    go sendMessage(c2, "two")

    for i := 0; i < 2; i++ {
        select {
        case msg := <-c1:
            fmt.Println("received", msg)
        case msg := <-c2:
            fmt.Println("received", msg)
        }
    }
}
```

_"Djikstra's guarded commands are adopted as sequential control structures, and as the sole means of introducing and controlling nondeterminism."_

=================== Notes ===================

Go's select statement is an implementation of guarded commands.

The select statement waits for one of the channels to send a message.

If both send at the same time it picks one at random (this is the nondeterminism).

If we never send a message on any of the channels then go throws a fatal error because we have a deadlock.

---

### Writing our web indexer

--

```mermaid
graph LR
    A[Seed Initial URLs] --> B[Record URL]
    B --> C[Retrieve HTML]
    C --> D[Parse for Links]
    D --> B
```

=================== Notes ===================

Remember the design we had.

The recorder sends messages to the retriever.

The retriever sends the HTML to the link parser.

And the link parser sends a list of links to the recorder.

Let's go through each of these processes

--

```go [1-7|1,7|2,6|3,5|4]
func RetrieveContent(urls <-chan string, retrieved chan<- Page) {
	for url := range urls {
		if resp, err := http.Get(url); err == nil {
			retrieved <- Page{address: url, content: resp.Body}
		}
	}
}
```

#### https://github.com/liamawhite/go-concurrency-example

=================== Notes ===================

CLICK THROUGH!

--

```go [1-4|7-18]
func ParseForLinks(retrieved <-chan Page, record chan<- []string) {
	for page := range retrieved {
		record <- parse(page)
	}
}

func parse(page Page) []string {
	// Use goquery because I'm lazy!
	doc, _ := goquery.NewDocumentFromReader(page.content)
	page.content.Close()
	res := make([]string, 0)
	doc.Find("a").Each(func(_ int, s *goquery.Selection) {
		link, _ := s.Attr("href")
		// Do some URL contruction magic
		res = append(res, link)
	})
	return res
}
```

#### https://github.com/liamawhite/go-concurrency-example

=================== Notes ===================

CLICK THROUGH!

--

```go [1,16|2,5,13,15|4-14]
func VisitedPageTracker(pending chan<- string) chan<- []string {
	record := make(chan []string)
	visitedPages := map[string]bool{}
	go func() {
		for pages := range record {
			for _, page := range pages {
				if !visitedPages[page] {
					fmt.Println("recording page", page)
					visitedPages[page] = true
					pending <- page
				}
			}
		}
	}()
	return record
}
```

#### https://github.com/liamawhite/go-concurrency-example

=================== Notes ===================

CLICK THROUGH!

--

```go [2-5,7,12|6,12,13|7,10,13]
func main() {
	// Pending must be buffered because the pipeline is circular and there are multiple links per page.
	// This is preferred over adding to pending concurrently as it sets an upper bound on memory usage.
	// There is an assumption here that one page will not contain more than 10000 links.
	pending := make(chan string, 10000)
	retrieved := make(chan Page)
	record := VisitedPageTracker(pending)

	// Send initial urls to be recorded
	go func() { record <- urls }()

	go RetrieveContent(pending, retrieved)
	go ParseForLinks(retrieved, record)

	// Run the code for 5 seconds.
	// Again, I'm lazy and this is a contrived example.
	time.Sleep(time.Second * 5)
}
}
```

#### https://github.com/liamawhite/go-concurrency-example

=================== Notes ===================

CLICK THROUGH!

---

## Summary

--

### Concurrency != Parallelism

--

### Good concurrent design decomposes the core logic into sequential routines. This makes it easier to reason about and test.

--

### The concurrency comes from their composition, sharing memory by sending messages.

--

### Shared memory is global state!

--

## Links
- [Concurrency is not Parallelism](https://www.youtube.com/watch?v=oV9rvDllKEg)
- [Communicating Sequential Process](https://www.cs.cmu.edu/~crary/819-f09/Hoare78.pdf)
- [Life of Occam-Pi](https://kar.kent.ac.uk/44827/1/life-of-occam-pi.pdf)
- [Share Memory By Communicating](https://blog.golang.org/codelab-share)
- [Web Crawler Example Repository](https://github.com/liamawhite/go-concurrency-example)
