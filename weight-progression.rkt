#lang typed/racket/base
(require "workout-types.rkt")
(define BARBELL-WEIGHT : Natural 45)
(define natural? exact-nonnegative-integer?)

(provide get-weight
         get-level)
;; Abstractly I went to describe what weights are available for a given resistance mode,
;; And what are the smallest increments between any given weight as possible.

;; Barbell progression starts at 45 and hypothetically continues on incrementing by 5lbs infinitely.
;; In reality caps at 355 in the apartment gym and probably like 900 at the commercial gym.
(: get-barbell-resistance-level (-> Natural Natural))
(define (get-barbell-resistance-level [weight : Natural])
  (assert (/ (- weight BARBELL-WEIGHT) 10) natural?))

(: get-barbell-weight (-> Natural Natural))
(define (get-barbell-weight [resistance-level : Natural])
  (+ BARBELL-WEIGHT (* resistance-level 10)))

;; Starts at 5lbs then 2.5lbs increments until 30lbs then 5lbs increments until 100lbs.
(: get-dumbbell-resistance-level (-> Natural Natural))
(define (get-dumbbell-resistance-level [weight : Natural])
  (let ([sub30-level (max (/ (* 10 weight) 25) (/ 300 25))]
        [post30-level (/ (- weight 30) 5)])
    (assert (round
           (if (< weight 30)
               sub30-level
               (+ sub30-level post30-level)))
          natural?)))

(: get-dumbbell-weight (-> Natural Natural))
(define (get-dumbbell-weight [resistance-level : Natural])
  (+ BARBELL-WEIGHT (* resistance-level 10)))

;; Machine starts at a specified weight and makes jumps until a specified weight.
(: get-machine-resistance-level (-> Natural Natural))
(define (get-machine-resistance-level [weight : Natural])
  (assert (round (/ weight 10)) natural?))

(: get-machine-weight (-> Natural Natural))
(define (get-machine-weight [resistance-level : Natural])
  (* resistance-level 10))

;; Cables just jump in increments of 10lbs.
(: get-cable-resistance-level (-> Natural Natural))
(define (get-cable-resistance-level [weight : Natural])
  (assert (/ weight 10) natural?))

(: get-cable-weight (-> Natural Natural))
(define (get-cable-weight [resistance-level : Natural])
  (* resistance-level 10))

(: get-level (-> ResistanceMode Natural Natural))
(define (get-level resistance-mode weight)
  (cond [(equal? resistance-mode 'Barbell) (get-barbell-resistance-level weight)]
        [(equal? resistance-mode 'Dumbbell) (get-dumbbell-resistance-level weight)]
        [(equal? resistance-mode 'Cable) (get-cable-resistance-level weight)]
        [(equal? resistance-mode 'Machine) (get-machine-resistance-level weight)]
        [#t 0]))

(: get-weight (-> ResistanceMode Natural Natural))
(define (get-weight resistance-mode resistance-level)
  (cond [(equal? resistance-mode 'Barbell) (get-barbell-weight resistance-level)]
        [(equal? resistance-mode 'Dumbbell) (get-dumbbell-weight resistance-level)]
        [(equal? resistance-mode 'Cable) (get-cable-weight resistance-level)]
        [(equal? resistance-mode 'Machine) (get-machine-weight resistance-level)]
        [#t 0]))