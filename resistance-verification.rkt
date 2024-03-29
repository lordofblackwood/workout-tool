#lang racket
(require "dumbbell.rkt"
         rosette)
(define-symbolic x z integer?)

;(define-symbolic y exact-nonnegative-integer?);Exact-Nonnegative-Integer)
;(forall (list x) (and (natural? x ) (= (get-dumbbell-weight (get-dumbbell-resistance-level x) x))))
;(vc)
;(clear-vc!)

(define (check-dumbbell y)
  (forall (list z)
          (assume (< x (add1 dumbbell-max-level)))
          (assume (natural? x))
          (assert (= (get-dumbbell-resistance-level (get-dumbbell-weight x) x)))
          (assert (= (get-dumbbell-weight (get-dumbbell-resistance-level x) x)))))

(time 600 (verify (check-dumbbell x)))

(forall (list z)
          (assume (natural? x))
          (assume (< x (add1 dumbbell-max-level)))
          (assert (= (get-dumbbell-resistance-level (get-dumbbell-weight x) x)))
          (assert (= (get-dumbbell-weight (get-dumbbell-resistance-level x) x))))