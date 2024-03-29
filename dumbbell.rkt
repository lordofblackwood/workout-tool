#lang racket/base
(require "workout-types.rkt")

(define dumbbell-max-level 26)
(provide DUMBBELL)

;; Starts at 5lbs then 2.5lbs increments until 30lbs then 5lbs increments until 100lbs.
;(: get-dumbbell-resistance-level (-> Real Real))
(define (get-dumbbell-resistance-level weight)
  (let ([sub30-level (min (/ (* 10 weight) 25) (/ 300 25))]
        [post30-level (/ (- weight 30) 5)])
    (if (< weight 30)
        sub30-level
        (+ sub30-level post30-level))))

;(: get-dumbbell-weight (-> Real Real))
(define (get-dumbbell-weight level)
  (let ([sub12-level (min (* level 2.5) 30)]
        [post12-level (* (- level 12) 5)])
    (if (< level 12)
        sub12-level
        (+ sub12-level post12-level))))

(define DUMBBELL
  (resistance get-dumbbell-resistance-level
              get-dumbbell-weight
              dumbbell-max-level))
  