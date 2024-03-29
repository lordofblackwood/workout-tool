#lang racket/base
(require rackunit
         "dumbbell.rkt")

(test-begin
 (let ([lst (build-list (add1 dumbbell-max-level) values)])
   (for-each
    (lambda (level)
      (check = (get-dumbbell-resistance-level (get-dumbbell-weight level)) level))
    lst)))


(test-begin
 (let ([lst (append (build-list 12 (λ (x) (* 2.5 x)))
                    (build-list (- (add1 dumbbell-max-level) 12)
                                (λ (x) (+ 30 (* 5 x)))))])
   (for-each
    (lambda (weight)
      (check = (get-dumbbell-weight (get-dumbbell-resistance-level weight)) weight))
    lst)))
